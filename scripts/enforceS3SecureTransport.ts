import { execFileSync } from "node:child_process";

import {
  GetBucketPolicyCommand,
  ListBucketsCommand,
  PutBucketPolicyCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import type { BucketPolicy, BucketStatus } from "./lib/s3SecureTransport";
import {
  classifyPolicy,
  isEphemeralStageBucket,
  mergePolicy,
  parsePolicy,
} from "./lib/s3SecureTransport";

type ReportStatus = BucketStatus | "error";

interface Options {
  apply: boolean;
  region: string;
  bucket?: string;
  showPolicy: boolean;
  noEphemeral: boolean;
}

interface CallerIdentity {
  ok: boolean;
  account?: string;
  arn?: string;
}

interface BucketReport {
  name: string;
  status: ReportStatus;
  policy?: BucketPolicy;
  error?: string;
}

interface ApplyResult {
  name: string;
  ok: boolean;
  error?: string;
}

const DEFAULT_REGION = "eu-west-2";

function readFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv: string[]): Options {
  return {
    apply: argv.includes("--apply"),
    region:
      readFlag(argv, "--region") ?? process.env.AWS_REGION ?? DEFAULT_REGION,
    bucket: readFlag(argv, "--bucket"),
    showPolicy: argv.includes("--show-policy"),
    noEphemeral: argv.includes("--no-ephemeral"),
  };
}

function getCallerIdentity(region: string): CallerIdentity {
  try {
    const output = execFileSync(
      "aws",
      ["sts", "get-caller-identity", "--output", "json", "--region", region],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const identity = JSON.parse(output) as { Account?: string; Arn?: string };
    return { ok: true, account: identity.Account, arn: identity.Arn };
  } catch {
    return { ok: false };
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNoSuchBucketPolicy(error: unknown): boolean {
  return (
    error instanceof S3ServiceException && error.name === "NoSuchBucketPolicy"
  );
}

async function fetchPolicy(
  client: S3Client,
  name: string,
): Promise<BucketPolicy | undefined> {
  try {
    const response = await client.send(
      new GetBucketPolicyCommand({ Bucket: name }),
    );
    return parsePolicy(response.Policy);
  } catch (error) {
    if (isNoSuchBucketPolicy(error)) return undefined;
    throw error;
  }
}

async function inspectBucket(
  client: S3Client,
  name: string,
): Promise<BucketReport> {
  try {
    const policy = await fetchPolicy(client, name);
    return { name, status: classifyPolicy(policy), policy };
  } catch (error) {
    return { name, status: "error", error: describeError(error) };
  }
}

async function applyPolicy(
  client: S3Client,
  report: BucketReport,
): Promise<ApplyResult> {
  const merged = mergePolicy(report.policy, report.name);
  try {
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: report.name,
        Policy: JSON.stringify(merged),
      }),
    );
    return { name: report.name, ok: true };
  } catch (error) {
    return { name: report.name, ok: false, error: describeError(error) };
  }
}

async function listBucketNames(
  client: S3Client,
  only: string | undefined,
): Promise<string[]> {
  if (only) return [only];
  const response = await client.send(new ListBucketsCommand({}));
  return (response.Buckets ?? [])
    .map((bucket) => bucket.Name)
    .filter((name): name is string => Boolean(name));
}

const ACTION_BY_STATUS: Record<ReportStatus, string> = {
  compliant: "ok",
  "missing-policy": "add policy",
  "policy-without-tls": "merge deny",
  error: "skipped",
};

function printBanner(
  options: Options,
  stage: string,
  identity: CallerIdentity,
): void {
  const mode = options.apply
    ? "APPLY (writes policies)"
    : "DRY RUN (no changes)";
  const caller = identity.ok
    ? `account ${identity.account ?? "unknown"} (${identity.arn ?? "unknown"})`
    : "unknown (aws sts get-caller-identity failed)";
  console.log("S3 SecureTransport enforcement");
  console.log(`  mode:   ${mode}`);
  console.log(`  stage:  ${stage}`);
  console.log(`  region: ${options.region}`);
  console.log(`  caller: ${caller}`);
  console.log("");
}

function printReportTable(reports: BucketReport[]): void {
  const nameWidth = Math.max(...reports.map((report) => report.name.length), 6);
  const statusWidth = Math.max(
    ...reports.map((report) => report.status.length),
    6,
  );
  console.log(
    `${"BUCKET".padEnd(nameWidth)}  ${"STATUS".padEnd(statusWidth)}  ACTION`,
  );
  reports.forEach((report) => {
    console.log(
      `${report.name.padEnd(nameWidth)}  ${report.status.padEnd(statusWidth)}  ${ACTION_BY_STATUS[report.status]}`,
    );
  });
}

function printPlannedPolicies(reports: BucketReport[]): void {
  console.log("\nPlanned policy changes:");
  reports.forEach((report) => {
    console.log(`\n# ${report.name} (${ACTION_BY_STATUS[report.status]})`);
    console.log(
      JSON.stringify(mergePolicy(report.policy, report.name), null, 2),
    );
  });
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const stage = process.env.STAGE ?? "unspecified";
  const identity = getCallerIdentity(options.region);

  printBanner(options, stage, identity);

  if (options.apply && !identity.ok) {
    console.error(
      "Refusing to --apply: could not confirm the target account via aws sts get-caller-identity.",
    );
    return 2;
  }

  const client = new S3Client({ region: options.region });
  const allNames = await listBucketNames(client, options.bucket);
  const names = options.noEphemeral
    ? allNames.filter((name) => !isEphemeralStageBucket(name))
    : allNames;

  if (options.noEphemeral) {
    console.log(
      `Excluded ${String(allNames.length - names.length)} ephemeral bucket(s).\n`,
    );
  }

  if (names.length === 0) {
    console.log("No buckets found.");
    return 0;
  }

  const reports = await Promise.all(
    names.map((name) => inspectBucket(client, name)),
  );

  printReportTable(reports);

  const errored = reports.filter((report) => report.status === "error");
  errored.forEach((report) => {
    console.warn(
      `  skipped ${report.name}: ${report.error ?? "unknown error"}`,
    );
  });

  const needingChange = reports.filter(
    (report) =>
      report.status === "missing-policy" ||
      report.status === "policy-without-tls",
  );

  if (needingChange.length === 0) {
    console.log(
      "\nAll buckets already enforce SecureTransport. Nothing to do.",
    );
    return options.apply && errored.length > 0 ? 1 : 0;
  }

  if (!options.apply) {
    if (options.showPolicy) {
      printPlannedPolicies(needingChange);
    }
    const compliant = reports.filter(
      (report) => report.status === "compliant",
    ).length;
    const hint = options.showPolicy
      ? ""
      : " (add --show-policy to see the exact JSON)";
    console.log(
      `\nDry run: ${String(needingChange.length)} to update, ${String(errored.length)} skipped, ${String(compliant)} already compliant. Re-run with --apply to write${hint}.`,
    );
    return 0;
  }

  const results = await Promise.all(
    needingChange.map((report) => applyPolicy(client, report)),
  );
  const succeeded = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);

  succeeded.forEach((result) => {
    console.log(`  updated ${result.name}`);
  });
  failed.forEach((result) => {
    console.error(
      `  failed ${result.name}: ${result.error ?? "unknown error"}`,
    );
  });

  console.log(
    `\nApplied to ${String(succeeded.length)}/${String(results.length)} bucket(s).`,
  );
  return failed.length > 0 || errored.length > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(describeError(error));
    process.exit(2);
  });
