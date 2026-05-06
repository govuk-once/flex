import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  CloudFormationClient,
  ListStacksCommand,
  ListStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  GetFunctionCommand,
  InvokeCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionUpdated,
} from "@aws-sdk/client-lambda";

import { sanitiseStageName } from "@flex/utils";

const PROBE_ENV_KEY = "COLD_START_PROBE";
const LOG_INGEST_WAIT_SECONDS = 30;
const QUERY_RETRY_ATTEMPTS = 4;
const QUERY_RETRY_GAP_SECONDS = 10;
const PROBE_CONCURRENCY = 5;
const QUERY_CONCURRENCY = 5;
const REPORTS_DIR = "reports";

const SKIP_STACK_SUFFIXES = [
  "-FlexPlatform",
  "-FlexCertStack",
  "-FlexApiDeployment",
  "-FlexCore",
];

interface CliArgs {
  readonly stage: string;
}

interface DiscoveredLambda {
  readonly functionName: string;
  readonly stackName: string;
  readonly domain: string;
}

interface ProbedLambda {
  readonly functionName: string;
  readonly domain: string;
  readonly accessTier: "vpc" | "non-vpc";
  readonly memorySize: number;
  readonly codeSize: number;
  readonly timeoutSeconds: number;
  readonly logGroupName: string;
  readonly invokeRequestId?: string;
  readonly probeError?: string;
}

interface CompletedLambda extends ProbedLambda {
  readonly initDurationMs: number | null;
  readonly billedDurationMs: number | null;
  readonly queryError?: string;
}

interface PercentileSummary {
  readonly p50: number;
  readonly p99: number;
  readonly max: number;
}

interface GroupSummary {
  readonly lambdaCount: number;
  readonly initDurationMs: PercentileSummary;
}

interface Report {
  readonly stage: string;
  readonly generatedAt: string;
  readonly summary: GroupSummary;
  readonly byDomain: Readonly<Record<string, GroupSummary>>;
  readonly byAccessTier: Readonly<Record<string, GroupSummary>>;
  readonly lambdas: readonly CompletedLambda[];
}

function parseArgs(argv: readonly string[]): CliArgs {
  const fromFlags = readFlag(argv, "--stage");
  const stage =
    fromFlags ??
    process.env.STAGE ??
    sanitiseStageName(process.env.USER) ??
    null;
  if (!stage) {
    throw new Error(
      "could not resolve target stage; pass --stage <name> or set STAGE / USER",
    );
  }
  return { stage };
}

function readFlag(argv: readonly string[], flag: string): string | undefined {
  const matches = argv
    .map((arg, i) => ({ arg, value: argv[i + 1] }))
    .filter((entry) => entry.arg === flag && entry.value !== undefined);
  return matches[0]?.value;
}

async function discoverLambdas(stage: string): Promise<DiscoveredLambda[]> {
  const cfn = new CloudFormationClient();
  const stackPrefix = `${stage}-`;
  const stackNames: string[] = [];

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
    page.StackSummaries?.forEach((summary) => {
      const name = summary.StackName ?? "";
      if (!name.startsWith(stackPrefix)) return;
      if (SKIP_STACK_SUFFIXES.some((suffix) => name.endsWith(suffix))) return;
      stackNames.push(name);
    });
    nextToken = page.NextToken;
  } while (nextToken);

  const lambdas: DiscoveredLambda[] = [];
  for (const stackName of stackNames) {
    const domain = stackName.slice(stackPrefix.length);
    let stackToken: string | undefined;
    do {
      const page = await cfn.send(
        new ListStackResourcesCommand({
          StackName: stackName,
          NextToken: stackToken,
        }),
      );
      page.StackResourceSummaries?.forEach((resource) => {
        if (resource.ResourceType !== "AWS::Lambda::Function") return;
        const functionName = resource.PhysicalResourceId;
        if (!functionName) return;
        lambdas.push({ functionName, stackName, domain });
      });
      stackToken = page.NextToken;
    } while (stackToken);
  }

  return lambdas.sort((a, b) => a.functionName.localeCompare(b.functionName));
}

async function fetchMetadata(
  lambda: DiscoveredLambda,
  client: LambdaClient,
): Promise<{
  probed: ProbedLambda;
  existingEnv: Readonly<Record<string, string>>;
}> {
  try {
    const existing = await client.send(
      new GetFunctionCommand({ FunctionName: lambda.functionName }),
    );
    const cfg = existing.Configuration;
    const vpcAttached = (cfg?.VpcConfig?.SubnetIds ?? []).length > 0;
    return {
      existingEnv: cfg?.Environment?.Variables ?? {},
      probed: {
        functionName: lambda.functionName,
        domain: lambda.domain,
        accessTier: vpcAttached ? "vpc" : "non-vpc",
        memorySize: cfg?.MemorySize ?? 0,
        codeSize: cfg?.CodeSize ?? 0,
        timeoutSeconds: cfg?.Timeout ?? 0,
        logGroupName:
          cfg?.LoggingConfig?.LogGroup ?? `/aws/lambda/${lambda.functionName}`,
      },
    };
  } catch (error) {
    return {
      existingEnv: {},
      probed: {
        functionName: lambda.functionName,
        domain: lambda.domain,
        accessTier: "non-vpc",
        memorySize: 0,
        codeSize: 0,
        timeoutSeconds: 0,
        logGroupName: `/aws/lambda/${lambda.functionName}`,
        probeError: `GetFunction failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

const REQUEST_ID_PATTERN = /START RequestId:\s+([0-9a-f-]+)/i;

async function probeLambda(
  lambda: DiscoveredLambda,
  client: LambdaClient,
): Promise<ProbedLambda> {
  // Always collect metadata first; if any subsequent step fails we
  // still want memory / code size / VPC info in the report.
  const metadata = await fetchMetadata(lambda, client);
  const probeStamp = String(Date.now());
  let invokeRequestId: string | undefined;
  let probeError: string | undefined;

  try {
    await client.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: lambda.functionName,
        Environment: {
          Variables: { ...metadata.existingEnv, [PROBE_ENV_KEY]: probeStamp },
        },
      }),
    );
    await waitUntilFunctionUpdated(
      { client, maxWaitTime: 60 },
      { FunctionName: lambda.functionName },
    );
    const invokeResult = await client.send(
      new InvokeCommand({
        FunctionName: lambda.functionName,
        Payload: Buffer.from("{}"),
        InvocationType: "RequestResponse",
        // Tail returns up to 4KB of the invocation log, base64-encoded.
        // The first line is `START RequestId: <id>` — we use that to
        // filter the Logs Insights query to the exact invocation we
        // triggered, avoiding races with unrelated traffic.
        LogType: "Tail",
      }),
    );
    invokeRequestId = extractRequestIdFromLogTail(invokeResult.LogResult);
  } catch (error) {
    probeError = error instanceof Error ? error.message : String(error);
  } finally {
    // Restore the original env so we leave no trace and don't create
    // CloudFormation drift. Done in finally so a failed invoke still
    // cleans up. Restore failure surfaces on its own as a probe error.
    try {
      await client.send(
        new UpdateFunctionConfigurationCommand({
          FunctionName: lambda.functionName,
          Environment: { Variables: { ...metadata.existingEnv } },
        }),
      );
      await waitUntilFunctionUpdated(
        { client, maxWaitTime: 60 },
        { FunctionName: lambda.functionName },
      );
    } catch (restoreError) {
      const message =
        restoreError instanceof Error
          ? restoreError.message
          : String(restoreError);
      probeError = probeError
        ? `${probeError}; restore failed: ${message}`
        : `restore failed: ${message}`;
    }
  }

  return {
    ...metadata.probed,
    invokeRequestId,
    probeError,
  };
}

function extractRequestIdFromLogTail(
  logResultBase64: string | undefined,
): string | undefined {
  if (!logResultBase64) return undefined;
  const tail = Buffer.from(logResultBase64, "base64").toString("utf8");
  const match = tail.match(REQUEST_ID_PATTERN);
  return match?.[1];
}

interface QueryResult {
  initDurationMs: number | null;
  billedDurationMs: number | null;
  queryError?: string;
}

async function queryInitDuration(
  probed: ProbedLambda,
  startTimeUnix: number,
  client: CloudWatchLogsClient,
): Promise<QueryResult> {
  if (probed.probeError) {
    return {
      initDurationMs: null,
      billedDurationMs: null,
      queryError: `probe failed: ${probed.probeError}`,
    };
  }

  // Logs Insights ingestion can lag by 30s+ for fresh invocations.
  // Retry the query a few times if it returns empty before giving up.
  for (let attempt = 0; attempt < QUERY_RETRY_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(QUERY_RETRY_GAP_SECONDS * 1000);
    const result = await runOneQuery(probed, startTimeUnix, client);
    if (result.queryError !== undefined) return result;
    if (result.initDurationMs !== null) return result;
  }
  return {
    initDurationMs: null,
    billedDurationMs: null,
    queryError: `no REPORT line after ${String(QUERY_RETRY_ATTEMPTS)} retries`,
  };
}

async function runOneQuery(
  probed: ProbedLambda,
  startTimeUnix: number,
  client: CloudWatchLogsClient,
): Promise<QueryResult> {
  // When we have the exact RequestId from the Invoke API call, filter
  // by it — that uniquely identifies the cold start we triggered and
  // is immune to races with unrelated traffic. Fall back to "latest
  // REPORT in window" if we couldn't extract the RequestId (defensive;
  // shouldn't happen for normal invocations).
  const queryString = probed.invokeRequestId
    ? `fields @timestamp, @initDuration, @billedDuration | filter @type = "REPORT" and @requestId = "${probed.invokeRequestId}" | limit 1`
    : 'fields @timestamp, @initDuration, @billedDuration | filter @type = "REPORT" and ispresent(@initDuration) | sort @timestamp desc | limit 1';

  try {
    const start = await client.send(
      new StartQueryCommand({
        logGroupName: probed.logGroupName,
        startTime: startTimeUnix,
        endTime: Math.floor(Date.now() / 1000),
        queryString,
      }),
    );
    const queryId = start.queryId;
    if (!queryId) {
      return {
        initDurationMs: null,
        billedDurationMs: null,
        queryError: "Logs Insights returned no queryId",
      };
    }

    let attempts = 0;
    while (attempts < 30) {
      await sleep(1000);
      attempts += 1;
      const result = await client.send(
        new GetQueryResultsCommand({ queryId }),
      );
      if (result.status === "Complete") {
        const row = result.results?.[0] ?? [];
        const initDuration = readFieldNumber(row, "@initDuration");
        const billedDuration = readFieldNumber(row, "@billedDuration");
        return {
          initDurationMs: initDuration,
          billedDurationMs: billedDuration,
        };
      }
      if (
        result.status &&
        ["Failed", "Cancelled", "Timeout"].includes(result.status)
      ) {
        return {
          initDurationMs: null,
          billedDurationMs: null,
          queryError: `query ${result.status}`,
        };
      }
    }

    return {
      initDurationMs: null,
      billedDurationMs: null,
      queryError: "query did not complete within 30s",
    };
  } catch (error) {
    return {
      initDurationMs: null,
      billedDurationMs: null,
      queryError: error instanceof Error ? error.message : String(error),
    };
  }
}

function readFieldNumber(
  row: ReadonlyArray<{ field?: string; value?: string }>,
  fieldName: string,
): number | null {
  const found = row.find((cell) => cell.field === fieldName);
  if (!found?.value) return null;
  const parsed = Number(found.value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function runInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(worker));
    batchResults.forEach((result) => results.push(result));
  }
  return results;
}

function summarise(durations: readonly number[]): PercentileSummary {
  if (durations.length === 0) return { p50: 0, p99: 0, max: 0 };
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    p50: pickPercentile(sorted, 0.5),
    p99: pickPercentile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function pickPercentile(sorted: readonly number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.floor(pct * (sorted.length - 1)),
  );
  return sorted[index] ?? 0;
}

function groupSummary(
  group: readonly CompletedLambda[],
): GroupSummary {
  const durations = group
    .map((entry) => entry.initDurationMs)
    .filter((value): value is number => value !== null);
  return {
    lambdaCount: group.length,
    initDurationMs: summarise(durations),
  };
}

function buildReport(
  stage: string,
  lambdas: readonly CompletedLambda[],
): Report {
  const sortedLambdas = [...lambdas].sort(
    (a, b) => (b.initDurationMs ?? -1) - (a.initDurationMs ?? -1),
  );
  const byDomain = groupBy(sortedLambdas, (l) => l.domain);
  const byAccessTier = groupBy(sortedLambdas, (l) => l.accessTier);

  return {
    stage,
    generatedAt: new Date().toISOString(),
    summary: groupSummary(sortedLambdas),
    byDomain: mapValues(byDomain, groupSummary),
    byAccessTier: mapValues(byAccessTier, groupSummary),
    lambdas: sortedLambdas,
  };
}

function groupBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): Readonly<Record<string, T[]>> {
  const out: Record<string, T[]> = {};
  items.forEach((item) => {
    const k = key(item);
    out[k] ??= [];
    out[k].push(item);
  });
  return out;
}

function mapValues<V, R>(
  obj: Readonly<Record<string, V>>,
  fn: (value: V) => R,
): Readonly<Record<string, R>> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, fn(v)]),
  );
}

function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Cold start report — ${report.stage}`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Lambdas probed: ${String(report.summary.lambdaCount)}`);
  lines.push(
    `Init duration p50/p99/max: ${formatMs(report.summary.initDurationMs.p50)} / ${formatMs(report.summary.initDurationMs.p99)} / ${formatMs(report.summary.initDurationMs.max)}`,
  );
  lines.push("");

  lines.push("## Top 10 slowest");
  lines.push("");
  lines.push("| # | Lambda | Domain | Tier | Mem | Code | Init |");
  lines.push("|---|--------|--------|------|-----|------|------|");
  report.lambdas.slice(0, 10).forEach((entry, i) => {
    lines.push(
      `| ${String(i + 1)} | \`${shortName(entry.functionName)}\` | ${entry.domain} | ${entry.accessTier} | ${String(entry.memorySize)} MB | ${formatBytes(entry.codeSize)} | ${formatMs(entry.initDurationMs)} |`,
    );
  });
  lines.push("");

  lines.push("## By domain");
  lines.push("");
  lines.push("| Domain | Lambdas | p50 | p99 | max |");
  lines.push("|--------|---------|-----|-----|-----|");
  Object.entries(report.byDomain).forEach(([domain, summary]) => {
    lines.push(
      `| ${domain} | ${String(summary.lambdaCount)} | ${formatMs(summary.initDurationMs.p50)} | ${formatMs(summary.initDurationMs.p99)} | ${formatMs(summary.initDurationMs.max)} |`,
    );
  });
  lines.push("");

  lines.push("## By access tier");
  lines.push("");
  lines.push("| Tier | Lambdas | p50 | p99 | max |");
  lines.push("|------|---------|-----|-----|-----|");
  Object.entries(report.byAccessTier).forEach(([tier, summary]) => {
    lines.push(
      `| ${tier} | ${String(summary.lambdaCount)} | ${formatMs(summary.initDurationMs.p50)} | ${formatMs(summary.initDurationMs.p99)} | ${formatMs(summary.initDurationMs.max)} |`,
    );
  });
  lines.push("");

  const failed = report.lambdas.filter(
    (l) => l.probeError !== undefined || l.queryError !== undefined,
  );
  if (failed.length > 0) {
    lines.push("## Probe / query failures");
    lines.push("");
    failed.forEach((entry) => {
      const reason = entry.probeError ?? entry.queryError ?? "unknown";
      lines.push(`- \`${shortName(entry.functionName)}\` — ${reason}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

function formatMs(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(0)}ms`;
}

function formatBytes(value: number): string {
  if (value <= 0) return "—";
  if (value < 1024) return `${String(value)}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function shortName(functionName: string): string {
  // Drop the trailing CDK random suffix (last hyphen-separated segment)
  // for a more readable column.
  const segments = functionName.split("-");
  if (segments.length <= 2) return functionName;
  return segments.slice(0, -1).join("-");
}

function reportFilename(stage: string, ext: string): string {
  const isoStamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `cold-starts-${stage}-${isoStamp}.${ext}`;
}

async function main(argv: readonly string[]): Promise<number> {
  const { stage } = parseArgs(argv);
  process.stdout.write(`probing cold starts for stage: ${stage}\n`);

  process.stdout.write("→ discovering lambdas…\n");
  const discovered = await discoverLambdas(stage);
  if (discovered.length === 0) {
    process.stderr.write(
      `no lambdas found in stacks matching "${stage}-*"\n`,
    );
    return 1;
  }
  process.stdout.write(`  found ${String(discovered.length)} lambda(s)\n`);

  const lambdaClient = new LambdaClient();
  const probeStartedAt = Math.floor(Date.now() / 1000);

  process.stdout.write(
    `→ probing (concurrency ${String(PROBE_CONCURRENCY)})…\n`,
  );
  const probed = await runInBatches(discovered, PROBE_CONCURRENCY, (lambda) =>
    probeLambda(lambda, lambdaClient),
  );
  probed.forEach((entry) => {
    const status = entry.probeError ? "✗" : "✓";
    process.stdout.write(`  ${status} ${shortName(entry.functionName)}\n`);
  });

  process.stdout.write(
    `→ waiting ${String(LOG_INGEST_WAIT_SECONDS)}s for log ingest…\n`,
  );
  await sleep(LOG_INGEST_WAIT_SECONDS * 1000);

  const logsClient = new CloudWatchLogsClient();
  process.stdout.write(
    `→ querying init durations (concurrency ${String(QUERY_CONCURRENCY)})…\n`,
  );
  const completed = await runInBatches(
    probed,
    QUERY_CONCURRENCY,
    async (entry) => {
      const result = await queryInitDuration(
        entry,
        probeStartedAt,
        logsClient,
      );
      return { ...entry, ...result } satisfies CompletedLambda;
    },
  );

  const report = buildReport(stage, completed);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const jsonPath = resolve(REPORTS_DIR, reportFilename(stage, "json"));
  const markdownPath = resolve(REPORTS_DIR, reportFilename(stage, "md"));
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");

  process.stdout.write("\ntop 10 slowest:\n");
  report.lambdas.slice(0, 10).forEach((entry, i) => {
    process.stdout.write(
      `  ${String(i + 1).padStart(2, " ")}. ${formatMs(entry.initDurationMs).padStart(7, " ")}  ${shortName(entry.functionName)}\n`,
    );
  });
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
