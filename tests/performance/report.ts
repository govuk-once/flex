import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";
import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataQuery,
  type MetricDataResult,
} from "@aws-sdk/client-cloudwatch";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ArtillerySummary {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
}

interface ArtilleryPeriod {
  counters: Record<string, number>;
  summaries: Record<string, ArtillerySummary>;
  firstMetricAt: number;
  lastMetricAt: number;
}

interface ArtilleryReport {
  aggregate: {
    counters: Record<string, number>;
    rates: Record<string, number>;
    summaries: Record<string, ArtillerySummary>;
    duration: number;
    firstMetricAt: number;
    lastMetricAt: number;
  };
  intermediate: ArtilleryPeriod[];
}

interface LambdaMetrics {
  functionName: string;
  invocations: number;
  errors: number;
  throttles: number;
  durationAvgMs: number;
  durationP95Ms: number;
  durationP99Ms: number;
  durationMaxMs: number;
  concurrentMax: number;
}

interface PhaseWindow {
  name: string;
  startOffset: number;
  endOffset: number;
}

interface PhaseStats {
  name: string;
  requests: number;
  errors: number;
  errorRate: string;
  p95: number;
  p99: number;
  maxRt: number;
}

const PHASE_CONFIGS: Record<string, PhaseWindow[]> = {
  spike: [
    { name: "idle",     startOffset: 0,   endOffset: 60  },
    { name: "spike",    startOffset: 60,  endOffset: 75  },
    { name: "hold",     startOffset: 75,  endOffset: 195 },
    { name: "drop",     startOffset: 195, endOffset: 210 },
    { name: "recovery", startOffset: 210, endOffset: 330 },
  ],
  "load-baseline": [
    { name: "warm-up",   startOffset: 0,  endOffset: 60  },
    { name: "sustained", startOffset: 60, endOffset: 360 },
  ],
  "load-growth": [
    { name: "ramp",      startOffset: 0,   endOffset: 120 },
    { name: "sustained", startOffset: 120, endOffset: 420 },
  ],
  stress: [
    { name: "confirm-baseline",  startOffset: 0,   endOffset: 60  },
    { name: "ramp-to-growth",    startOffset: 60,  endOffset: 180 },
    { name: "ramp-to-capacity",  startOffset: 180, endOffset: 360 },
    { name: "find-ceiling",      startOffset: 360, endOffset: 480 },
  ],
  soak: Array.from({ length: 6 }, (_, i) => ({
    name: `${i * 5}–${(i + 1) * 5} min`,
    startOffset: i * 300,
    endOffset: (i + 1) * 300,
  })),
};

function detectPhases(filename: string): PhaseWindow[] | null {
  for (const [key, phases] of Object.entries(PHASE_CONFIGS)) {
    if (filename.includes(key)) return phases;
  }
  return null;
}

function countErrors(counters: Record<string, number>): number {
  return Object.entries(counters)
    .filter(([k]) => k.startsWith("http.codes.4") || k.startsWith("http.codes.5") || k.startsWith("errors."))
    .reduce((sum, [, v]) => sum + v, 0);
}

function aggregatePhase(
  periods: ArtilleryPeriod[],
  testStartMs: number,
  phase: PhaseWindow,
): PhaseStats {
  const startMs = testStartMs + phase.startOffset * 1000;
  const endMs   = testStartMs + phase.endOffset   * 1000;

  const buckets = periods.filter(
    (p) => p.firstMetricAt >= startMs && p.firstMetricAt < endMs,
  );

  const requests = buckets.reduce((s, b) => s + (b.counters["http.requests"] ?? 0), 0);
  const errors   = buckets.reduce((s, b) => s + countErrors(b.counters), 0);
  const rt       = (b: ArtilleryPeriod) => b.summaries["http.response_time"];
  const p95  = buckets.length ? Math.max(...buckets.map((b) => rt(b)?.p95  ?? 0)) : 0;
  const p99  = buckets.length ? Math.max(...buckets.map((b) => rt(b)?.p99  ?? 0)) : 0;
  const maxRt = buckets.length ? Math.max(...buckets.map((b) => rt(b)?.max ?? 0)) : 0;

  return {
    name: phase.name,
    requests,
    errors,
    errorRate: requests > 0 ? ((errors / requests) * 100).toFixed(2) : "0.00",
    p95,
    p99,
    maxRt,
  };
}

function ms(value: number): string {
  return `${Math.round(value)}ms`;
}

function statusClass(p95: number, threshold: number): string {
  return p95 <= threshold ? "pass" : "fail";
}

function codeClass(code: string): string {
  if (code.startsWith("2")) return "pass";
  if (code.startsWith("4") || code.startsWith("5")) return "fail";
  return "";
}

function buildCard(name: string, report: ArtilleryReport): string {
  const { counters, rates, summaries, duration } = report.aggregate;
  const rt = summaries["http.response_time"] ?? ({} as ArtillerySummary);
  const requests = counters["http.requests"] ?? 0;
  const responses = counters["http.responses"] ?? 0;
  const errors = countErrors(counters);
  const errorRate = responses > 0 ? ((errors / responses) * 100).toFixed(2) : "0.00";
  const rps = (rates["http.request_rate"] ?? 0).toFixed(1);
  const p95Class = statusClass(rt.p95, name.includes("post") ? 1500 : 1000);

  const statusCodes = Object.entries(counters)
    .filter(([k]) => k.startsWith("http.codes."))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      const code = k.replace("http.codes.", "");
      return `<tr class="${codeClass(code)}"><td>HTTP ${code}</td><td>${v}</td></tr>`;
    })
    .join("");

  const engineErrors = Object.entries(counters)
    .filter(([k]) => k.startsWith("errors."))
    .map(([k, v]) => `<tr class="fail"><td>${k.replace("errors.", "error: ")}</td><td>${v}</td></tr>`)
    .join("");

  return `
    <div class="card">
      <h2>${name}</h2>
      <p class="meta">Duration: ${duration}s &nbsp;|&nbsp; Requests: ${requests} &nbsp;|&nbsp; RPS: ${rps}</p>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Min</td><td>${ms(rt.min)}</td></tr>
          <tr><td>Median (p50)</td><td>${ms(rt.p50)}</td></tr>
          <tr><td>p75</td><td>${ms(rt.p75)}</td></tr>
          <tr class="${p95Class}"><td>p95</td><td>${ms(rt.p95)}</td></tr>
          <tr><td>p99</td><td>${ms(rt.p99)}</td></tr>
          <tr><td>Max</td><td>${ms(rt.max)}</td></tr>
          <tr><td>Error rate</td><td>${errorRate}%</td></tr>
        </tbody>
      </table>
      <h3>Response codes</h3>
      <table>
        <thead><tr><th>Code</th><th>Count</th></tr></thead>
        <tbody>${statusCodes}${engineErrors || ""}</tbody>
      </table>
    </div>`;
}

function buildPhaseSection(name: string, report: ArtilleryReport, phases: PhaseWindow[]): string {
  const testStartMs = report.aggregate.firstMetricAt;
  const rows = phases
    .map((phase) => aggregatePhase(report.intermediate ?? [], testStartMs, phase))
    .map((s) => `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.requests}</td>
        <td class="${parseFloat(s.errorRate) > 1 ? "fail" : s.errors > 0 ? "warn" : "pass"}">${s.errors} (${s.errorRate}%)</td>
        <td>${ms(s.p95)}</td>
        <td>${ms(s.p99)}</td>
        <td>${ms(s.maxRt)}</td>
      </tr>`)
    .join("");

  return `
    <div class="card phase-card">
      <h2>${name} — phase breakdown</h2>
      <p class="meta">p95/p99 = worst bucket within the phase window</p>
      <table>
        <thead>
          <tr>
            <th>Phase</th>
            <th>Requests</th>
            <th>Errors</th>
            <th>p95</th>
            <th>p99</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function fetchLambdaMetrics(
  functionName: string,
  startTime: Date,
  endTime: Date,
  region: string,
): Promise<LambdaMetrics> {
  const client = new CloudWatchClient({ region });

  const dim = [{ Name: "FunctionName", Value: functionName }];
  const period = 60;

  const queries: MetricDataQuery[] = [
    { Id: "invocations", MetricStat: { Metric: { Namespace: "AWS/Lambda", MetricName: "Invocations", Dimensions: dim }, Period: period, Stat: "Sum" } },
    { Id: "errors",      MetricStat: { Metric: { Namespace: "AWS/Lambda", MetricName: "Errors",      Dimensions: dim }, Period: period, Stat: "Sum" } },
    { Id: "throttles",   MetricStat: { Metric: { Namespace: "AWS/Lambda", MetricName: "Throttles",   Dimensions: dim }, Period: period, Stat: "Sum" } },
    { Id: "durAvg",      MetricStat: { Metric: { Namespace: "AWS/Lambda", MetricName: "Duration",    Dimensions: dim }, Period: period, Stat: "Average" } },
    { Id: "durP95",      MetricStat: { Metric: { Namespace: "AWS/Lambda", MetricName: "Duration",    Dimensions: dim }, Period: period, Stat: "p95" } },
    { Id: "durP99",      MetricStat: { Metric: { Namespace: "AWS/Lambda", MetricName: "Duration",    Dimensions: dim }, Period: period, Stat: "p99" } },
    { Id: "durMax",      MetricStat: { Metric: { Namespace: "AWS/Lambda", MetricName: "Duration",    Dimensions: dim }, Period: period, Stat: "Maximum" } },
    { Id: "concurrent",  MetricStat: { Metric: { Namespace: "AWS/Lambda", MetricName: "ConcurrentExecutions", Dimensions: dim }, Period: period, Stat: "Maximum" } },
  ];

  const result = await client.send(new GetMetricDataCommand({
    MetricDataQueries: queries,
    StartTime: startTime,
    EndTime: endTime,
    ScanBy: "TimestampAscending",
  }));

  const vals = (id: string): number[] =>
    result.MetricDataResults?.find((r: MetricDataResult) => r.Id === id)?.Values ?? [];
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const max = (v: number[]) => (v.length ? Math.max(...v) : 0);
  const avg = (v: number[]) => (v.length ? sum(v) / v.length : 0);

  return {
    functionName,
    invocations: sum(vals("invocations")),
    errors: sum(vals("errors")),
    throttles: sum(vals("throttles")),
    durationAvgMs: avg(vals("durAvg")),
    durationP95Ms: max(vals("durP95")),
    durationP99Ms: max(vals("durP99")),
    durationMaxMs: max(vals("durMax")),
    concurrentMax: max(vals("concurrent")),
  };
}

function buildLambdaCard(m: LambdaMetrics): string {
  const pct = (n: number) =>
    m.invocations > 0 ? `(${((n / m.invocations) * 100).toFixed(2)}%)` : "";

  return `
    <div class="card lambda-card">
      <h2>&#955; ${m.functionName}</h2>
      <p class="meta">Invocations: ${m.invocations} &nbsp;|&nbsp; Peak concurrent: ${m.concurrentMax}</p>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Duration avg</td><td>${ms(m.durationAvgMs)}</td></tr>
          <tr><td>Duration p95</td><td>${ms(m.durationP95Ms)}</td></tr>
          <tr><td>Duration p99</td><td>${ms(m.durationP99Ms)}</td></tr>
          <tr><td>Duration max</td><td>${ms(m.durationMaxMs)}</td></tr>
          <tr class="${m.errors > 0 ? "fail" : "pass"}"><td>Errors</td><td>${m.errors} ${pct(m.errors)}</td></tr>
          <tr class="${m.throttles > 0 ? "fail" : "pass"}"><td>Throttles</td><td>${m.throttles} ${pct(m.throttles)}</td></tr>
        </tbody>
      </table>
    </div>`;
}

function buildHtml(
  artilleryCards: string[],
  phaseSections: string[],
  lambdaCards: string[],
  generatedAt: string,
): string {
  const phaseSection = phaseSections.length
    ? `<h2 class="section-heading">Phase Breakdown</h2><div class="cards">${phaseSections.join("")}</div>`
    : "";
  const lambdaSection = lambdaCards.length
    ? `<h2 class="section-heading">Lambda</h2><div class="cards">${lambdaCards.join("")}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Artillery Performance Report</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f5f5f5; margin: 0; padding: 2rem; color: #222; }
    h1 { margin-bottom: 0.25rem; }
    .section-heading { margin: 2rem 0 0.75rem; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.875rem; margin-bottom: 2rem; }
    .cards { display: flex; flex-wrap: wrap; gap: 1.5rem; }
    .card { background: #fff; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,0.1); min-width: 280px; }
    .phase-card { min-width: 560px; border-top: 3px solid #d97706; }
    .lambda-card { border-top: 3px solid #7c3aed; }
    .card h2 { margin-top: 0; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: #444; }
    .card .meta { margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    td, th { padding: 0.4rem 0.5rem; border-bottom: 1px solid #eee; }
    th { text-align: left; font-weight: 600; color: #555; font-size: 0.8rem; }
    td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    th:not(:first-child) { text-align: right; }
    tr.pass td:last-child { color: #16a34a; font-weight: 600; }
    tr.fail td:last-child { color: #dc2626; font-weight: 600; }
    td.pass { color: #16a34a; font-weight: 600; }
    td.fail { color: #dc2626; font-weight: 600; }
    td.warn { color: #d97706; font-weight: 600; }
    .card h3 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 1rem 0 0.5rem; }
  </style>
</head>
<body>
  <h1>Artillery Performance Report</h1>
  <p class="meta">Generated: ${generatedAt}</p>
  <h2 class="section-heading">HTTP</h2>
  <div class="cards">${artilleryCards.join("")}</div>
  ${phaseSection}
  ${lambdaSection}
</body>
</html>`;
}

async function main(): Promise<void> {
  const resultsDir = resolve(__dirname, "results");
  const files = readdirSync(resultsDir).filter(
    (f) => f.endsWith(".json") && !f.includes("combined"),
  );

  if (files.length === 0) {
    console.error("No JSON result files found in results/");
    process.exit(1);
  }

  const reports = files.map((file) => {
    const raw = readFileSync(resolve(resultsDir, file), "utf-8");
    return { name: basename(file, ".json"), report: JSON.parse(raw) as ArtilleryReport };
  });

  const artilleryCards = reports.map(({ name, report }) => buildCard(name, report));

  const phaseSections = reports.flatMap(({ name, report }) => {
    const phases = detectPhases(name);
    if (!phases || !report.intermediate?.length) return [];
    return [buildPhaseSection(name, report, phases)];
  });

  // Derive test window across all result files with a 2-min buffer for CloudWatch propagation.
  const allFirst = reports.map((r) => r.report.aggregate.firstMetricAt).filter(Boolean);
  const allLast  = reports.map((r) => r.report.aggregate.lastMetricAt).filter(Boolean);
  const windowStart = new Date(Math.min(...allFirst) - 2 * 60 * 1000);
  const windowEnd   = new Date(Math.max(...allLast)  + 2 * 60 * 1000);

  const lambdaCards: string[] = [];
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  const rawNames = process.env.LAMBDA_FUNCTION_NAMES;

  if (rawNames && region) {
    const functionNames = rawNames.split(",").map((s) => s.trim()).filter(Boolean);
    console.log(`[report] fetching CloudWatch metrics for ${functionNames.length} function(s) in ${region}...`);
    console.log(`[report] window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

    const results = await Promise.allSettled(
      functionNames.map((fn) => fetchLambdaMetrics(fn, windowStart, windowEnd, region)),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        lambdaCards.push(buildLambdaCard(result.value));
      } else {
        console.warn(`[report] CloudWatch fetch failed: ${result.reason}`);
      }
    }
  } else if (!rawNames) {
    console.log("[report] LAMBDA_FUNCTION_NAMES not set — skipping Lambda metrics");
  } else {
    console.log("[report] AWS_REGION / AWS_DEFAULT_REGION not set — skipping Lambda metrics");
  }

  const out = resolve(resultsDir, "combined-report.html");
  writeFileSync(out, buildHtml(artilleryCards, phaseSections, lambdaCards, new Date().toISOString()));
  console.log(`Report written to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
