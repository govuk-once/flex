// Natural-chain cold-start probe.
//
// Invokes a real flex public endpoint via HTTPS (with a stub JWT) after
// forcing every Lambda in the downstream chain to be cold. The chain
// runs naturally through API Gateway and the production integration
// path, so the wall-clock we measure is what a real user would see if
// every Lambda involved happened to cold-start at once.
//
// Defaults to dvla driving-licence -> udp identity (the canonical
// production cascade). Override --path / --cold to test other chains.
//
// Usage:
//   STAGE=pr-257 pnpm cold-starts-cascade
//   STAGE=pr-257 pnpm cold-starts-cascade \
//     --path /dvla/v1/driving-licence \
//     --cold get-users-drivers-licence,get-service-identity \
//     --samples 10 --warm-samples 20
//
// Path format: /<domain>/<version>/<route> — the script prepends
// flex's public `/app` mount-point automatically. Mirrors how e2e
// tests construct URLs against the cloudfront fixture.
//
// Auth: stub JWT generated via the same path as `pnpm jwt`.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  CloudFormationClient,
  ListStacksCommand,
  ListStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import {
  GetFunctionCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionUpdated,
} from "@aws-sdk/client-lambda";

import { getStackOutputs, sanitiseStageName } from "@flex/utils";

import { getJwtClient } from "../tests/e2e/src/setup.global";

const PROBE_ENV_KEY = "COLD_START_PROBE";
const SAMPLES_DEFAULT = 10;
const WARM_SAMPLES_DEFAULT = 20;
const REPORTS_DIR = "reports";

const DEFAULT_PATH = "/dvla/v1/driving-licence";
const DEFAULT_COLD_HINTS = [
  "get-users-drivers-licence",
  "get-service-identity",
];

// flex mounts every public domain route under this prefix on the
// public APIGW, fronted by CloudFront. The e2e cloudfront fixture
// uses the same base (`${FLEX_API_URL}/app`).
const PUBLIC_API_MOUNT_PREFIX = "/app";

interface CliArgs {
  readonly stage: string;
  readonly path: string;
  readonly coldHints: readonly string[];
  readonly samples: number;
  readonly warmSamples: number;
}

interface ResolvedLambda {
  readonly hint: string;
  readonly functionName: string;
  readonly memorySize: number;
  readonly existingEnv: Readonly<Record<string, string>>;
}

interface PercentileSummary {
  readonly min: number;
  readonly p50: number;
  readonly p99: number;
  readonly max: number;
  readonly mean: number;
}

interface ChainSample {
  readonly totalMs: number;
  readonly status: number;
}

interface Report {
  readonly stage: string;
  readonly generatedAt: string;
  readonly path: string;
  readonly coldChain: readonly { hint: string; functionName: string; memorySize: number }[];
  readonly cold: { samples: number; total: PercentileSummary };
  readonly warm: { samples: number; total: PercentileSummary };
  readonly deltaMsP50: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const stage =
    readFlag(argv, "--stage") ??
    process.env.STAGE ??
    sanitiseStageName(process.env.USER) ??
    null;
  if (!stage) {
    throw new Error(
      "could not resolve target stage; pass --stage <name> or set STAGE / USER",
    );
  }
  const samplesRaw = readFlag(argv, "--samples") ?? process.env.SAMPLES;
  const samples = samplesRaw ? Number(samplesRaw) : SAMPLES_DEFAULT;
  const warmRaw = readFlag(argv, "--warm-samples") ?? process.env.WARM_SAMPLES;
  const warmSamples = warmRaw ? Number(warmRaw) : WARM_SAMPLES_DEFAULT;
  if (!Number.isInteger(samples) || samples < 1) {
    throw new Error(`invalid --samples value "${String(samplesRaw)}"`);
  }
  if (!Number.isInteger(warmSamples) || warmSamples < 0) {
    throw new Error(`invalid --warm-samples value "${String(warmRaw)}"`);
  }
  const coldRaw = readFlag(argv, "--cold");
  const coldHints = coldRaw
    ? coldRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
    : DEFAULT_COLD_HINTS;
  return {
    stage,
    path: readFlag(argv, "--path") ?? DEFAULT_PATH,
    coldHints,
    samples,
    warmSamples,
  };
}

function readFlag(argv: readonly string[], flag: string): string | undefined {
  const matches = argv
    .map((arg, i) => ({ arg, value: argv[i + 1] }))
    .filter((entry) => entry.arg === flag && entry.value !== undefined);
  return matches[0]?.value;
}

async function findFunctionByHint(
  stage: string,
  hint: string,
  cfn: CloudFormationClient,
): Promise<string> {
  const stackPrefix = `${stage}-`;
  const stacks: string[] = [];
  let nextToken: string | undefined;
  do {
    const page = await cfn.send(
      new ListStacksCommand({
        NextToken: nextToken,
        StackStatusFilter: [
          "CREATE_COMPLETE",
          "UPDATE_COMPLETE",
          "UPDATE_ROLLBACK_COMPLETE",
        ],
      }),
    );
    page.StackSummaries?.forEach((s) => {
      if (s.StackName?.startsWith(stackPrefix)) stacks.push(s.StackName);
    });
    nextToken = page.NextToken;
  } while (nextToken);

  const camelHint = hint
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  for (const stackName of stacks) {
    let stackToken: string | undefined;
    do {
      const page = await cfn.send(
        new ListStackResourcesCommand({
          StackName: stackName,
          NextToken: stackToken,
        }),
      );
      const match = page.StackResourceSummaries?.find(
        (r) =>
          r.ResourceType === "AWS::Lambda::Function" &&
          (r.PhysicalResourceId?.includes(camelHint) ||
            r.PhysicalResourceId?.toLowerCase().includes(
              hint.replace(/-/g, "").toLowerCase(),
            )),
      );
      if (match?.PhysicalResourceId) return match.PhysicalResourceId;
      stackToken = page.NextToken;
    } while (stackToken);
  }
  throw new Error(`no Lambda found for hint "${hint}" in stage "${stage}"`);
}

async function fetchMetadata(
  hint: string,
  functionName: string,
  client: LambdaClient,
): Promise<ResolvedLambda> {
  const response = await client.send(
    new GetFunctionCommand({ FunctionName: functionName }),
  );
  const cfg = response.Configuration;
  return {
    hint,
    functionName,
    memorySize: cfg?.MemorySize ?? 0,
    existingEnv: cfg?.Environment?.Variables ?? {},
  };
}

async function bumpEnvAndWait(
  lambda: ResolvedLambda,
  stamp: string,
  client: LambdaClient,
): Promise<void> {
  await client.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: lambda.functionName,
      Environment: {
        Variables: { ...lambda.existingEnv, [PROBE_ENV_KEY]: stamp },
      },
    }),
  );
  await waitUntilFunctionUpdated(
    { client, maxWaitTime: 60 },
    { FunctionName: lambda.functionName },
  );
}

async function restoreEnv(
  lambda: ResolvedLambda,
  client: LambdaClient,
): Promise<void> {
  await client.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: lambda.functionName,
      Environment: { Variables: { ...lambda.existingEnv } },
    }),
  );
  await waitUntilFunctionUpdated(
    { client, maxWaitTime: 60 },
    { FunctionName: lambda.functionName },
  );
}

async function callEndpoint(
  url: string,
  jwt: string,
): Promise<ChainSample> {
  const t0 = Date.now();
  const response = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${jwt}` },
  });
  // Drain body so timing reflects full response, not just headers.
  await response.text();
  return { totalMs: Date.now() - t0, status: response.status };
}

function summarise(values: readonly number[]): PercentileSummary {
  if (values.length === 0) {
    return { min: 0, p50: 0, p99: 0, max: 0, mean: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  return {
    min: sorted[0] ?? 0,
    p50: sorted[Math.floor(0.5 * (sorted.length - 1))] ?? 0,
    p99: sorted[Math.floor(0.99 * (sorted.length - 1))] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean: sum / values.length,
  };
}

function buildReport(
  stage: string,
  path: string,
  chain: readonly ResolvedLambda[],
  cold: readonly ChainSample[],
  warm: readonly ChainSample[],
): Report {
  const coldTotal = summarise(cold.map((r) => r.totalMs));
  const warmTotal = summarise(warm.map((r) => r.totalMs));
  return {
    stage,
    generatedAt: new Date().toISOString(),
    path,
    coldChain: chain.map((c) => ({
      hint: c.hint,
      functionName: c.functionName,
      memorySize: c.memorySize,
    })),
    cold: { samples: cold.length, total: coldTotal },
    warm: { samples: warm.length, total: warmTotal },
    deltaMsP50: coldTotal.p50 - warmTotal.p50,
  };
}

function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Natural-chain cold-start report — ${report.stage}`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Path: \`${report.path}\``);
  lines.push("");
  lines.push("## Forced-cold chain");
  lines.push("");
  lines.push("| Hint | Function | Memory |");
  lines.push("|------|----------|--------|");
  report.coldChain.forEach((c) => {
    lines.push(
      `| \`${c.hint}\` | \`${c.functionName}\` | ${String(c.memorySize)} MB |`,
    );
  });
  lines.push("");
  lines.push("## End-to-end wall-clock");
  lines.push("");
  lines.push("| Stage | Samples | min | p50 | mean | p99 | max |");
  lines.push("|-------|---------|-----|-----|------|-----|-----|");
  lines.push(
    `| Cold  | ${String(report.cold.samples)} | ${formatMs(report.cold.total.min)} | ${formatMs(report.cold.total.p50)} | ${formatMs(report.cold.total.mean)} | ${formatMs(report.cold.total.p99)} | ${formatMs(report.cold.total.max)} |`,
  );
  lines.push(
    `| Warm  | ${String(report.warm.samples)} | ${formatMs(report.warm.total.min)} | ${formatMs(report.warm.total.p50)} | ${formatMs(report.warm.total.mean)} | ${formatMs(report.warm.total.p99)} | ${formatMs(report.warm.total.max)} |`,
  );
  lines.push(`| **Δ p50** | | | **${formatMs(report.deltaMsP50)}** | | | |`);
  lines.push("");
  return lines.join("\n");
}

function formatMs(value: number): string {
  return `${value.toFixed(0)}ms`;
}

function reportFilename(stage: string, ext: string): string {
  const isoStamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `cold-starts-cascade-${stage}-${isoStamp}.${ext}`;
}

const FlexApiUrlOutputSchema = "FlexApiUrl";

async function resolveApiUrl(stage: string): Promise<string> {
  const outputs = await getStackOutputs(`${stage}-FlexPlatform`);
  const url = outputs[FlexApiUrlOutputSchema];
  if (!url) {
    throw new Error(
      `${stage}-FlexPlatform stack does not export FlexApiUrl`,
    );
  }
  return url;
}

async function main(argv: readonly string[]): Promise<number> {
  const { stage, path, coldHints, samples, warmSamples } = parseArgs(argv);

  process.stdout.write(
    `cascade probe — stage ${stage}, path ${path}, cold ${String(samples)} + warm ${String(warmSamples)}\n`,
  );
  process.stdout.write(`forcing cold: ${coldHints.join(", ")}\n`);

  const apiUrl = await resolveApiUrl(stage);
  const trimmedBase = apiUrl.replace(/\/$/, "");
  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = `${trimmedBase}${PUBLIC_API_MOUNT_PREFIX}${normalisedPath}`;
  process.stdout.write(`url: ${fullUrl}\n`);

  process.stdout.write("→ generating stub JWT…\n");
  const jwt = await (await getJwtClient(stage)).getToken();

  const cfn = new CloudFormationClient();
  const lambdaClient = new LambdaClient();

  process.stdout.write("→ resolving lambdas…\n");
  const chain: ResolvedLambda[] = [];
  for (const hint of coldHints) {
    const fn = await findFunctionByHint(stage, hint, cfn);
    const meta = await fetchMetadata(hint, fn, lambdaClient);
    chain.push(meta);
    process.stdout.write(`  ${hint} → ${fn} (${String(meta.memorySize)} MB)\n`);
  }

  const cold: ChainSample[] = [];
  try {
    process.stdout.write(`\n→ cold pass (${String(samples)} samples)…\n`);
    for (let i = 0; i < samples; i += 1) {
      const stamp = `${String(Date.now())}-${String(i)}`;
      // Bump every chain Lambda in parallel — independent updates.
      await Promise.all(
        chain.map((lambda) => bumpEnvAndWait(lambda, stamp, lambdaClient)),
      );
      const sample = await callEndpoint(fullUrl, jwt);
      cold.push(sample);
      process.stdout.write(
        `  ${String(i + 1).padStart(2, " ")}. status ${String(sample.status)}  total ${formatMs(sample.totalMs).padStart(7, " ")}\n`,
      );
    }
  } finally {
    process.stdout.write(`\n→ restoring env on chain lambdas…\n`);
    await Promise.all(
      chain.map((lambda) =>
        restoreEnv(lambda, lambdaClient).catch((e: unknown) => {
          process.stderr.write(
            `  failed to restore ${lambda.hint}: ${e instanceof Error ? e.message : String(e)}\n`,
          );
        }),
      ),
    );
  }

  await sleep(2000);

  process.stdout.write(`\n→ warm pass (${String(warmSamples)} samples)…\n`);
  if (warmSamples > 0) {
    // Prime so warm samples hit a stable container.
    await callEndpoint(fullUrl, jwt);
  }
  const warm: ChainSample[] = [];
  for (let i = 0; i < warmSamples; i += 1) {
    const sample = await callEndpoint(fullUrl, jwt);
    warm.push(sample);
    process.stdout.write(
      `  ${String(i + 1).padStart(2, " ")}. status ${String(sample.status)}  total ${formatMs(sample.totalMs).padStart(7, " ")}\n`,
    );
  }

  const report = buildReport(stage, path, chain, cold, warm);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const jsonPath = resolve(REPORTS_DIR, reportFilename(stage, "json"));
  const markdownPath = resolve(REPORTS_DIR, reportFilename(stage, "md"));
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");

  process.stdout.write(`\nsummary:\n`);
  process.stdout.write(
    `  cold p50: ${formatMs(report.cold.total.p50)}  warm p50: ${formatMs(report.warm.total.p50)}  Δ p50: ${formatMs(report.deltaMsP50)}\n`,
  );
  process.stdout.write(`\nreport: ${jsonPath}\n`);
  process.stdout.write(`        ${markdownPath}\n`);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(2);
  });
