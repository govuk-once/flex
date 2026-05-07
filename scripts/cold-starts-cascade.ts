// Cascade cold-start probe.
//
// Approximates the user-visible cost of an integration chain
// (e.g. dvla -> udp) by invoking two Lambdas sequentially, with both
// forced cold for the cold pass and both warm for the warm pass.
// The aggregate wall-clock time roughly matches a real chain because
// real chains pay each Lambda's cold start in sequence plus a small
// HTTP overhead (~10-20ms intra-region) we don't simulate here.
//
// Usage:
//   STAGE=pr-257 pnpm cold-starts-cascade
//   STAGE=pr-257 pnpm cold-starts-cascade --samples 20 --warm-samples 30
//
// Defaults to perf domain's cascade-entry / cascade-target Lambdas.
// Override with --entry / --target to test arbitrary chains.

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
  InvokeCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionUpdated,
} from "@aws-sdk/client-lambda";

import { sanitiseStageName } from "@flex/utils";

const PROBE_ENV_KEY = "COLD_START_PROBE";
const SAMPLES_DEFAULT = 10;
const WARM_SAMPLES_DEFAULT = 20;
const REPORTS_DIR = "reports";

interface CliArgs {
  readonly stage: string;
  readonly entryHint: string;
  readonly targetHint: string;
  readonly samples: number;
  readonly warmSamples: number;
}

interface ResolvedLambda {
  readonly functionName: string;
  readonly memorySize: number;
  readonly codeSize: number;
  readonly existingEnv: Readonly<Record<string, string>>;
}

interface PercentileSummary {
  readonly min: number;
  readonly p50: number;
  readonly p99: number;
  readonly max: number;
  readonly mean: number;
}

interface CascadeRun {
  readonly entryMs: number;
  readonly targetMs: number;
  readonly totalMs: number;
}

interface Report {
  readonly stage: string;
  readonly generatedAt: string;
  readonly entry: { name: string; memory: number; codeSize: number };
  readonly target: { name: string; memory: number; codeSize: number };
  readonly cold: {
    samples: number;
    entry: PercentileSummary;
    target: PercentileSummary;
    total: PercentileSummary;
  };
  readonly warm: {
    samples: number;
    entry: PercentileSummary;
    target: PercentileSummary;
    total: PercentileSummary;
  };
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
    throw new Error(
      `invalid --samples value "${String(samplesRaw)}"; must be a positive integer`,
    );
  }
  if (!Number.isInteger(warmSamples) || warmSamples < 0) {
    throw new Error(
      `invalid --warm-samples value "${String(warmRaw)}"; must be a non-negative integer`,
    );
  }
  return {
    stage,
    entryHint: readFlag(argv, "--entry") ?? "perf-cascade-entry",
    targetHint: readFlag(argv, "--target") ?? "perf-cascade-target",
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
): Promise<string> {
  // Hint matches the route's `name` from domain.config.ts (e.g.
  // "perf-cascade-entry"); CDK turns it into a logical id like
  // "PerfPublicV1PerfCascadeEntryFunction". We list resources of all
  // ${stage}-* stacks and pick the Lambda whose physical id contains
  // a camelCased version of the hint.
  const cfn = new CloudFormationClient();
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

async function fetchLambdaMetadata(
  functionName: string,
  client: LambdaClient,
): Promise<ResolvedLambda> {
  const response = await client.send(
    new GetFunctionCommand({ FunctionName: functionName }),
  );
  const cfg = response.Configuration;
  return {
    functionName,
    memorySize: cfg?.MemorySize ?? 0,
    codeSize: cfg?.CodeSize ?? 0,
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

async function timedInvoke(
  functionName: string,
  client: LambdaClient,
): Promise<number> {
  const t0 = Date.now();
  await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from("{}"),
      InvocationType: "RequestResponse",
    }),
  );
  return Date.now() - t0;
}

async function runColdSample(
  entry: ResolvedLambda,
  target: ResolvedLambda,
  index: number,
  client: LambdaClient,
): Promise<CascadeRun> {
  const stamp = `${String(Date.now())}-${String(index)}`;
  // Bump both in parallel — independent updates against different
  // functions, no concurrency contention on AWS side.
  await Promise.all([
    bumpEnvAndWait(entry, stamp, client),
    bumpEnvAndWait(target, stamp, client),
  ]);
  const entryMs = await timedInvoke(entry.functionName, client);
  const targetMs = await timedInvoke(target.functionName, client);
  return { entryMs, targetMs, totalMs: entryMs + targetMs };
}

async function runWarmSample(
  entry: ResolvedLambda,
  target: ResolvedLambda,
  client: LambdaClient,
): Promise<CascadeRun> {
  const entryMs = await timedInvoke(entry.functionName, client);
  const targetMs = await timedInvoke(target.functionName, client);
  return { entryMs, targetMs, totalMs: entryMs + targetMs };
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
  entry: ResolvedLambda,
  target: ResolvedLambda,
  cold: readonly CascadeRun[],
  warm: readonly CascadeRun[],
): Report {
  const coldEntry = summarise(cold.map((r) => r.entryMs));
  const coldTarget = summarise(cold.map((r) => r.targetMs));
  const coldTotal = summarise(cold.map((r) => r.totalMs));
  const warmEntry = summarise(warm.map((r) => r.entryMs));
  const warmTarget = summarise(warm.map((r) => r.targetMs));
  const warmTotal = summarise(warm.map((r) => r.totalMs));

  return {
    stage,
    generatedAt: new Date().toISOString(),
    entry: {
      name: entry.functionName,
      memory: entry.memorySize,
      codeSize: entry.codeSize,
    },
    target: {
      name: target.functionName,
      memory: target.memorySize,
      codeSize: target.codeSize,
    },
    cold: {
      samples: cold.length,
      entry: coldEntry,
      target: coldTarget,
      total: coldTotal,
    },
    warm: {
      samples: warm.length,
      entry: warmEntry,
      target: warmTarget,
      total: warmTotal,
    },
    deltaMsP50: coldTotal.p50 - warmTotal.p50,
  };
}

function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Cascade cold-start report — ${report.stage}`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Entry:  \`${report.entry.name}\` (${String(report.entry.memory)} MB, ${formatBytes(report.entry.codeSize)})`);
  lines.push(`Target: \`${report.target.name}\` (${String(report.target.memory)} MB, ${formatBytes(report.target.codeSize)})`);
  lines.push("");
  lines.push(`Cold samples: ${String(report.cold.samples)}, warm samples: ${String(report.warm.samples)}`);
  lines.push("");

  lines.push("## Aggregate chain time (entry + target wall-clock)");
  lines.push("");
  lines.push("| Stage | min | p50 | mean | p99 | max |");
  lines.push("|-------|-----|-----|------|-----|-----|");
  lines.push(
    `| Cold  | ${formatMs(report.cold.total.min)} | ${formatMs(report.cold.total.p50)} | ${formatMs(report.cold.total.mean)} | ${formatMs(report.cold.total.p99)} | ${formatMs(report.cold.total.max)} |`,
  );
  lines.push(
    `| Warm  | ${formatMs(report.warm.total.min)} | ${formatMs(report.warm.total.p50)} | ${formatMs(report.warm.total.mean)} | ${formatMs(report.warm.total.p99)} | ${formatMs(report.warm.total.max)} |`,
  );
  lines.push(`| **Δ p50** | | **${formatMs(report.deltaMsP50)}** | | | |`);
  lines.push("");

  lines.push("## Per-Lambda breakdown");
  lines.push("");
  lines.push("| Lambda | Phase | min | p50 | mean | p99 | max |");
  lines.push("|--------|-------|-----|-----|------|-----|-----|");
  lines.push(
    `| entry  | cold | ${formatMs(report.cold.entry.min)} | ${formatMs(report.cold.entry.p50)} | ${formatMs(report.cold.entry.mean)} | ${formatMs(report.cold.entry.p99)} | ${formatMs(report.cold.entry.max)} |`,
  );
  lines.push(
    `| entry  | warm | ${formatMs(report.warm.entry.min)} | ${formatMs(report.warm.entry.p50)} | ${formatMs(report.warm.entry.mean)} | ${formatMs(report.warm.entry.p99)} | ${formatMs(report.warm.entry.max)} |`,
  );
  lines.push(
    `| target | cold | ${formatMs(report.cold.target.min)} | ${formatMs(report.cold.target.p50)} | ${formatMs(report.cold.target.mean)} | ${formatMs(report.cold.target.p99)} | ${formatMs(report.cold.target.max)} |`,
  );
  lines.push(
    `| target | warm | ${formatMs(report.warm.target.min)} | ${formatMs(report.warm.target.p50)} | ${formatMs(report.warm.target.mean)} | ${formatMs(report.warm.target.p99)} | ${formatMs(report.warm.target.max)} |`,
  );
  lines.push("");

  lines.push("## Caveat");
  lines.push("");
  lines.push("This script orchestrates the chain externally — it invokes entry");
  lines.push("then target sequentially. A real flex chain (e.g. dvla calling");
  lines.push("udp via integration) goes through API Gateway, adding ~10–20ms");
  lines.push("HTTP overhead per hop on top of these numbers. The cold-start");
  lines.push("penalties (the dominant cost) are captured accurately.");
  return lines.join("\n");
}

function formatMs(value: number): string {
  return `${value.toFixed(0)}ms`;
}

function formatBytes(value: number): string {
  if (value <= 0) return "—";
  if (value < 1024) return `${String(value)}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function reportFilename(stage: string, ext: string): string {
  const isoStamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `cold-starts-cascade-${stage}-${isoStamp}.${ext}`;
}

async function main(argv: readonly string[]): Promise<number> {
  const { stage, entryHint, targetHint, samples, warmSamples } =
    parseArgs(argv);

  process.stdout.write(
    `cascade probe — stage ${stage}, ${String(samples)} cold + ${String(warmSamples)} warm samples\n`,
  );
  process.stdout.write(
    `entry hint: ${entryHint}\ntarget hint: ${targetHint}\n`,
  );

  const entryName = await findFunctionByHint(stage, entryHint);
  const targetName = await findFunctionByHint(stage, targetHint);
  process.stdout.write(`resolved entry  → ${entryName}\n`);
  process.stdout.write(`resolved target → ${targetName}\n`);

  const lambdaClient = new LambdaClient();
  const entry = await fetchLambdaMetadata(entryName, lambdaClient);
  const target = await fetchLambdaMetadata(targetName, lambdaClient);

  const cold: CascadeRun[] = [];
  try {
    process.stdout.write(`\n→ cold pass (${String(samples)} samples)…\n`);
    for (let i = 0; i < samples; i += 1) {
      const run = await runColdSample(entry, target, i, lambdaClient);
      cold.push(run);
      process.stdout.write(
        `  ${String(i + 1).padStart(2, " ")}. entry ${formatMs(run.entryMs).padStart(7, " ")}  target ${formatMs(run.targetMs).padStart(7, " ")}  total ${formatMs(run.totalMs).padStart(7, " ")}\n`,
      );
    }
  } finally {
    process.stdout.write(`\n→ restoring env on both lambdas…\n`);
    await Promise.all([
      restoreEnv(entry, lambdaClient).catch((e: unknown) => {
        process.stderr.write(
          `  failed to restore entry env: ${e instanceof Error ? e.message : String(e)}\n`,
        );
      }),
      restoreEnv(target, lambdaClient).catch((e: unknown) => {
        process.stderr.write(
          `  failed to restore target env: ${e instanceof Error ? e.message : String(e)}\n`,
        );
      }),
    ]);
  }

  // Brief pause so warm pass hits the post-restore container, not
  // whatever ephemeral state was left mid-restore.
  await sleep(2000);

  process.stdout.write(`\n→ warm pass (${String(warmSamples)} samples)…\n`);
  // Prime: run one invoke pair so both Lambdas are guaranteed warm
  // before we start sampling (the env restore creates a new container
  // for the next invoke).
  if (warmSamples > 0) {
    await runWarmSample(entry, target, lambdaClient);
  }
  const warm: CascadeRun[] = [];
  for (let i = 0; i < warmSamples; i += 1) {
    const run = await runWarmSample(entry, target, lambdaClient);
    warm.push(run);
    process.stdout.write(
      `  ${String(i + 1).padStart(2, " ")}. entry ${formatMs(run.entryMs).padStart(7, " ")}  target ${formatMs(run.targetMs).padStart(7, " ")}  total ${formatMs(run.totalMs).padStart(7, " ")}\n`,
    );
  }

  const report = buildReport(stage, entry, target, cold, warm);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const jsonPath = resolve(REPORTS_DIR, reportFilename(stage, "json"));
  const markdownPath = resolve(REPORTS_DIR, reportFilename(stage, "md"));
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");

  process.stdout.write(`\nsummary:\n`);
  process.stdout.write(
    `  cold total p50: ${formatMs(report.cold.total.p50)}  (entry ${formatMs(report.cold.entry.p50)} + target ${formatMs(report.cold.target.p50)})\n`,
  );
  process.stdout.write(
    `  warm total p50: ${formatMs(report.warm.total.p50)}  (entry ${formatMs(report.warm.entry.p50)} + target ${formatMs(report.warm.target.p50)})\n`,
  );
  process.stdout.write(`  Δ p50: ${formatMs(report.deltaMsP50)}\n`);
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
