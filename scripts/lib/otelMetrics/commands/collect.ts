import type { TimedValue } from "../analysis";
import {
  compareSeries,
  countBy,
  formatNumber,
  labelBytes,
  median,
  promqlPoints,
  sumValues,
  tagLabelNames,
} from "../analysis";
import type { Credentials } from "../awsCli";
import { awsJson, exportCredentials } from "../awsCli";
import type { Evidence } from "../evidence";
import type { Options } from "../options";
import type { PromqlPath } from "../promql";
import { describeReply, listOf, matrixOf, promql, vectorOf } from "../promql";
import {
  apiLatencyQuantile,
  LAMBDA_VARIANTS,
  lambdaDurationByDomain,
  lambdaErrorsByStage,
  lambdaInvocationsByDomain,
  lambdaSeriesSelector,
  metricsInsightsInvocationsByDomain,
} from "../queries";
import { readStatus, reportStatus } from "../status";

const STEP_SECONDS = 300;
const QUANTILES = [
  { quantile: 0.5, statistic: "p50" },
  { quantile: 0.9, statistic: "p90" },
  { quantile: 0.99, statistic: "p99" },
];

interface Window {
  start: number;
  end: number;
  label: string;
}

interface ClassicDatapoint {
  Timestamp?: string;
  ExtendedStatistics?: Record<string, number>;
}

interface MetricDataResult {
  Label?: string;
  Values?: number[];
  StatusCode?: string;
}

function windowFor(hours: number): Window {
  const end =
    Math.floor((Date.now() / 1000 - 600) / STEP_SECONDS) * STEP_SECONDS;
  const start = end - Math.round(hours * 3600);
  return { start, end, label: `${String(Math.round(hours * 60))}m` };
}

function iso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function query(
  options: Options,
  credentials: Credentials,
  evidence: Evidence,
  file: string,
  path: PromqlPath,
  params: [string, string][],
) {
  const reply = promql(options.region, credentials, path, params);
  evidence.save(file, { path, params, reply });
  return reply;
}

function labelsSection(
  options: Options,
  credentials: Credentials,
  evidence: Evidence,
  window: Window,
  stage: string,
): void {
  const range: [string, string][] = [
    ["start", String(window.start)],
    ["end", String(window.end)],
  ];
  const selector = lambdaSeriesSelector(stage);
  const labels = query(
    options,
    credentials,
    evidence,
    "lambda-labels.json",
    "labels",
    [["match[]", selector], ...range],
  );
  const series = query(
    options,
    credentials,
    evidence,
    "lambda-series.json",
    "series",
    [["match[]", selector], ...range],
  );
  const labelNames = listOf<string>(labels);
  const seriesList = listOf<Record<string, string>>(series);
  const tags = tagLabelNames(labelNames);
  const bytes = seriesList.map(labelBytes);
  const owners = countBy(
    seriesList,
    (labelSet) => labelSet["@aws.tag.ResourceOwner"] ?? "(none)",
  );
  const withResource = seriesList.filter(
    (labelSet) => labelSet.Resource !== undefined,
  ).length;

  evidence.line("## 1. Labels on enriched Lambda metrics");
  evidence.line();
  evidence.line(
    `Selector \`${selector}\`. Labels: ${describeReply(labels)}. Series: ${describeReply(series)}.`,
  );
  evidence.line();
  evidence.table(
    ["Item", "Value"],
    [
      ["Duration series for this stage", String(seriesList.length)],
      ["Series with a Resource label", String(withResource)],
      ["Label names", String(labelNames.length)],
      ["Tag labels", tags.join(", ") || "none"],
      [
        "CloudFormation system tags present",
        tags.some((name) => name.includes("aws:cloudformation")) ? "yes" : "no",
      ],
      [
        "Median label bytes per series (proxy for data point size)",
        formatNumber(median(bytes), 0),
      ],
      [
        "Series per ResourceOwner",
        [...owners.entries()]
          .map(([owner, count]) => `${owner}: ${String(count)}`)
          .join(", ") || "none",
      ],
    ],
  );
  evidence.line(
    seriesList.length === 0
      ? "No enriched series found. Check that enrichment is running, that the stage had Lambda traffic in the window, and that the Stage tag value is right."
      : "Full label sets are in `lambda-series.json`.",
  );
  evidence.line();
}

function classicLatency(options: Options, evidence: Evidence, window: Window) {
  const classic = awsJson<{ Datapoints?: ClassicDatapoint[] }>(options.region, [
    "cloudwatch",
    "get-metric-statistics",
    "--namespace",
    "AWS/ApiGateway",
    "--metric-name",
    "Latency",
    "--dimensions",
    `Name=ApiName,Value=${options.api.apiName}`,
    `Name=Stage,Value=${options.api.apiStage}`,
    `Name=Method,Value=${options.api.method}`,
    `Name=Resource,Value=${options.api.resource}`,
    "--start-time",
    iso(window.start),
    "--end-time",
    iso(window.end),
    "--period",
    String(STEP_SECONDS),
    "--extended-statistics",
    ...QUANTILES.map(({ statistic }) => statistic),
  ]);
  evidence.save("api-latency-classic.json", classic);
  return classic;
}

function classicPoints(
  datapoints: ClassicDatapoint[],
  statistic: string,
): TimedValue[] {
  return datapoints
    .map((point) => ({
      timestamp: Math.round(new Date(point.Timestamp ?? 0).getTime() / 1000),
      value: point.ExtendedStatistics?.[statistic] ?? Number.NaN,
    }))
    .filter((point) => Number.isFinite(point.value))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function regraphSection(
  options: Options,
  credentials: Credentials,
  evidence: Evidence,
  window: Window,
): void {
  const classic = classicLatency(options, evidence, window);
  const datapoints = classic.ok ? (classic.value.Datapoints ?? []) : [];

  evidence.line("## 2. Re-graph: API Gateway latency, classic against PromQL");
  evidence.line();
  const classicSummary = classic.ok
    ? String(datapoints.length) + " datapoints"
    : "error: " + classic.error;
  evidence.line(
    `Widget: \`${options.api.method} ${options.api.resource}\` on API \`${options.api.apiName}\`, stage \`${options.api.apiStage}\`, ${iso(window.start)} to ${iso(window.end)}, ${String(STEP_SECONDS)} s steps. Classic: ${classicSummary}.`,
  );
  evidence.line();
  evidence.line(
    "A classic datapoint at T covers [T, T+5m); a PromQL point at t with `[5m]` covers (t-5m, t]. Both alignments are shown; the shifted one is the like-for-like comparison.",
  );
  evidence.line();

  const rows = QUANTILES.flatMap(({ quantile, statistic }) => {
    const expression = apiLatencyQuantile(quantile, options.api);
    const reply = query(
      options,
      credentials,
      evidence,
      `api-latency-promql-${statistic}.json`,
      "query_range",
      [
        ["query", expression],
        ["start", String(window.start)],
        ["end", String(window.end)],
        ["step", `${String(STEP_SECONDS)}s`],
      ],
    );
    const matrix = matrixOf(reply);
    const points = promqlPoints(matrix[0]?.values ?? []);
    const classicSeries = classicPoints(datapoints, statistic);
    const shifted = compareSeries(classicSeries, points, STEP_SECONDS);
    const unshifted = compareSeries(classicSeries, points, 0);
    evidence.save(`api-latency-comparison-${statistic}.json`, {
      expression,
      shifted,
      unshifted,
    });
    return [shifted, unshifted].map((comparison, index) => [
      statistic,
      index === 0 ? "PromQL t-5m = classic T" : "same timestamp",
      `${describeReply(reply)}, ${String(matrix.length)} series`,
      String(comparison.stats.matched),
      formatNumber(comparison.stats.medianAbsoluteDifference),
      formatNumber(comparison.stats.maxAbsoluteDifference),
      formatNumber(
        (comparison.stats.medianRelativeDifference ?? Number.NaN) * 100,
        1,
      ),
    ]);
  });
  evidence.table(
    [
      "Statistic",
      "Alignment",
      "PromQL reply",
      "Points matched",
      "Median abs diff (ms)",
      "Max abs diff (ms)",
      "Median rel diff (%)",
    ],
    rows,
  );
  evidence.line(
    `PromQL expression (p99): \`${apiLatencyQuantile(0.99, options.api)}\`. Per-point values are in \`api-latency-comparison-*.json\`.`,
  );
  evidence.line();
}

function variantLines(
  evidence: Evidence,
  results: {
    variant: string;
    expression: string;
    reply: Parameters<typeof describeReply>[0];
  }[],
): void {
  results.forEach(({ variant, expression, reply }) => {
    evidence.line(`- ${variant}: \`${expression}\` (${describeReply(reply)}).`);
  });
}

function domainSection(
  options: Options,
  credentials: Credentials,
  evidence: Evidence,
  window: Window,
  stage: string,
): void {
  const results = LAMBDA_VARIANTS.map((variant) => {
    const expression = lambdaDurationByDomain(0.95, stage, variant);
    const reply = query(
      options,
      credentials,
      evidence,
      `lambda-duration-p95-by-domain-${variant}.json`,
      "query_range",
      [
        ["query", expression],
        ["start", String(window.start)],
        ["end", String(window.end)],
        ["step", `${String(STEP_SECONDS)}s`],
      ],
    );
    const rows = matrixOf(reply).map((series) => {
      const values = promqlPoints(series.values).map((point) => point.value);
      return [
        variant,
        series.metric["@aws.tag.ResourceOwner"] ?? "(none)",
        String(values.length),
        formatNumber(median(values)),
        formatNumber(values.length ? Math.max(...values) : undefined),
      ];
    });
    return { variant, expression, reply, rows };
  });

  evidence.line(
    "## 3. What tags add: Lambda p95 Duration per domain on one stage",
  );
  evidence.line();
  evidence.line(
    "Without tags this needs one metric line per function. Shown over all series and over series without a `Resource` label, because it is not yet known which form carries the function-level data.",
  );
  evidence.line();
  variantLines(evidence, results);
  evidence.line();
  evidence.table(
    [
      "Series",
      "ResourceOwner",
      "5-minute points",
      "Median p95 (ms)",
      "Highest p95 (ms)",
    ],
    results.flatMap(({ rows }) => rows),
  );
}

function metricsInsightsTotals(
  options: Options,
  evidence: Evidence,
  window: Window,
  stage: string,
): Map<string, number> {
  const expression = metricsInsightsInvocationsByDomain(stage);
  const result = awsJson<{ MetricDataResults?: MetricDataResult[] }>(
    options.region,
    [
      "cloudwatch",
      "get-metric-data",
      "--metric-data-queries",
      JSON.stringify([
        { Id: "invocations", Expression: expression, Period: STEP_SECONDS },
      ]),
      "--start-time",
      iso(window.start),
      "--end-time",
      iso(window.end),
    ],
  );
  evidence.save("metrics-insights-invocations.json", { expression, result });
  const results = result.ok ? (result.value.MetricDataResults ?? []) : [];
  return new Map(
    results.map((entry) => [
      entry.Label ?? "(none)",
      sumValues(entry.Values ?? []),
    ]),
  );
}

function comparisonSection(
  options: Options,
  credentials: Credentials,
  evidence: Evidence,
  window: Window,
  stage: string,
): void {
  const insights = metricsInsightsTotals(options, evidence, window, stage);
  const promqlTotals = LAMBDA_VARIANTS.map((variant) => {
    const reply = query(
      options,
      credentials,
      evidence,
      `lambda-invocations-${variant}.json`,
      "query",
      [
        ["query", lambdaInvocationsByDomain(stage, window.label, variant)],
        ["time", String(window.end)],
      ],
    );
    return {
      variant,
      reply,
      totals: new Map(
        vectorOf(reply).map((sample) => [
          sample.metric["@aws.tag.ResourceOwner"] ?? "(none)",
          Number(sample.value[1]),
        ]),
      ),
    };
  });
  const owners = [
    ...new Set([
      ...insights.keys(),
      ...promqlTotals.flatMap((entry) => [...entry.totals.keys()]),
    ]),
  ].sort();

  evidence.line(
    "## 4. Same question without PromQL: Metrics Insights with tags",
  );
  evidence.line();
  evidence.line(
    `Total Lambda invocations per domain on \`${stage}\` over the window. Metrics Insights: \`${metricsInsightsInvocationsByDomain(stage)}\`. PromQL is shown over all series and over function-level series only (\`Resource=""\`), to show whether qualified series double-count.`,
  );
  evidence.line();
  evidence.table(
    [
      "ResourceOwner",
      "Metrics Insights",
      ...promqlTotals.map((entry) => `PromQL ${entry.variant}`),
    ],
    owners.map((owner) => [
      owner,
      formatNumber(insights.get(owner), 0),
      ...promqlTotals.map((entry) => formatNumber(entry.totals.get(owner), 0)),
    ]),
  );
  const replies = promqlTotals
    .map((entry) => entry.variant + " " + describeReply(entry.reply))
    .join("; ");
  evidence.line(
    `PromQL replies: ${replies}. Metrics Insights labels are whatever CloudWatch returns for the group; see \`metrics-insights-invocations.json\`.`,
  );
  evidence.line();
}

function errorsSection(
  options: Options,
  credentials: Credentials,
  evidence: Evidence,
  window: Window,
): void {
  const results = LAMBDA_VARIANTS.map((variant) => {
    const expression = lambdaErrorsByStage(window.label, variant);
    const reply = query(
      options,
      credentials,
      evidence,
      `lambda-errors-by-stage-${variant}.json`,
      "query",
      [
        ["query", expression],
        ["time", String(window.end)],
      ],
    );
    const rows = vectorOf(reply).map((sample) => [
      variant,
      sample.metric["@aws.tag.Stage"] ?? "(none)",
      formatNumber(Number(sample.value[1]), 0),
    ]);
    return { variant, expression, reply, rows };
  });
  evidence.line("## 5. Lambda errors per stage across the account");
  evidence.line();
  variantLines(evidence, results);
  evidence.line();
  evidence.table(
    ["Series", "Stage", "Errors"],
    results.flatMap(({ rows }) => rows),
  );
}

export function collect(options: Options, evidence: Evidence): number {
  if (!options.stage) {
    evidence.line(
      "collect needs --stage <stage>, the value of the Stage tag to query.",
    );
    evidence.finish();
    return 2;
  }
  const credentials = exportCredentials();
  if (!credentials.ok) {
    evidence.line(
      `Could not export credentials with \`aws configure export-credentials\`: ${credentials.error}`,
    );
    evidence.finish();
    return 2;
  }
  const window = windowFor(options.hours);
  const status = readStatus(options.region);
  evidence.save("status.json", status);

  evidence.line(
    `# OTel metrics spike: collect (stage ${options.stage}, ${options.region})`,
  );
  evidence.line();
  evidence.line(
    `Run at ${new Date().toISOString()}. Window ${iso(window.start)} to ${iso(window.end)}. Read-only; PromQL API calls are charged at $0.01 per million samples scanned.`,
  );
  evidence.line();
  reportStatus(evidence, status, "Account state");

  labelsSection(options, credentials.value, evidence, window, options.stage);
  regraphSection(options, credentials.value, evidence, window);
  domainSection(options, credentials.value, evidence, window, options.stage);
  comparisonSection(
    options,
    credentials.value,
    evidence,
    window,
    options.stage,
  );
  errorsSection(options, credentials.value, evidence, window);

  evidence.line("## Still to do by hand");
  evidence.line();
  evidence.line(
    "- Query Studio: run the section 2 and 3 expressions, add one to a dashboard, then save `aws cloudwatch get-dashboard --dashboard-name <name>` into this folder.",
  );
  evidence.line(
    `- Logs Insights on a ${options.stage} Lambda log group: \`filter @aws.tag.Stage = '${options.stage}' | stats count() by @aws.tag.ResourceOwner\`.`,
  );
  evidence.line(
    "- Screenshots of the classic widget and the PromQL graph for the same hour.",
  );
  evidence.finish();
  return 0;
}
