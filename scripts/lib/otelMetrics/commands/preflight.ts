import { estimateMonthlyCost, formatNumber } from "../analysis";
import { awsJson, firstLine } from "../awsCli";
import type { Evidence } from "../evidence";
import { namespacesFor, SUPPORTED_NAMESPACES } from "../namespaces";
import type { Options } from "../options";
import { readStatus, reportStatus } from "../status";

interface ListedMetric {
  Namespace?: string;
  MetricName?: string;
}

const BYTES_PER_POINT = [450, 1000];

function countSeries(metrics: ListedMetric[], namespaces: string[]): number {
  return metrics.filter((metric) => namespaces.includes(metric.Namespace ?? ""))
    .length;
}

function namespaceRows(metrics: ListedMetric[]): string[][] {
  return SUPPORTED_NAMESPACES.map((namespace) => [
    namespace,
    String(countSeries(metrics, [namespace])),
  ]).filter(([, count]) => count !== "0");
}

function costRows(seriesByMode: [string, number][]): string[][] {
  return seriesByMode.flatMap(([mode, series]) =>
    BYTES_PER_POINT.map((bytes) => {
      const estimate = estimateMonthlyCost(series, bytes);
      return [
        mode,
        String(series),
        String(bytes),
        formatNumber(estimate.gbPerMonth),
        formatNumber(estimate.usdPerMonth),
      ];
    }),
  );
}

export function preflight(options: Options, evidence: Evidence): number {
  const status = readStatus(options.region);
  evidence.save("status.json", status);

  evidence.line(`# OTel metrics spike: preflight (${options.region})`);
  evidence.line();
  evidence.line(`Run at ${new Date().toISOString()}. Read-only.`);
  evidence.line();
  reportStatus(evidence, status, "Account state");

  const tools = {
    aws: firstLine("aws", ["--version"]),
    curl: firstLine("curl", ["--version"]),
  };
  evidence.save("tools.json", tools);
  evidence.line("## Tools");
  evidence.line();
  evidence.table(
    ["Tool", "Version"],
    [
      ["aws", tools.aws],
      ["curl", tools.curl],
    ],
  );

  const indexes = awsJson<unknown>(options.region, [
    "resource-explorer-2",
    "list-indexes",
  ]);
  evidence.save("resource-explorer-indexes.json", indexes);
  evidence.line("## Resource Explorer indexes");
  evidence.line();
  evidence.line(
    indexes.ok
      ? "Saved to `resource-explorer-indexes.json`. An existing index or aggregator is worth raising with Platform before `enable`."
      : `Could not list: ${indexes.error.split("\n")[0] ?? ""}`,
  );
  evidence.line();

  const listed = awsJson<{ Metrics?: ListedMetric[] }>(options.region, [
    "cloudwatch",
    "list-metrics",
    "--recently-active",
    "PT3H",
  ]);
  if (!listed.ok) {
    evidence.line(`list-metrics failed: ${listed.error}`);
    evidence.finish();
    return 1;
  }
  const metrics = listed.value.Metrics ?? [];
  evidence.save(
    "namespace-counts.json",
    Object.fromEntries(namespaceRows(metrics)),
  );

  evidence.line("## Series active in the last 3 hours, by supported namespace");
  evidence.line();
  evidence.table(["Namespace", "Series"], namespaceRows(metrics));

  const seriesByMode: [string, number][] = [
    ["scoped", countSeries(metrics, namespacesFor("scoped"))],
    ["all", countSeries(metrics, namespacesFor("all"))],
  ];
  evidence.line(
    "## Cost ceiling, if every series reported every minute for 30 days",
  );
  evidence.line();
  evidence.line(
    "$0.50 per GB enriched. 450 bytes is AWS's own example; 1,000 bytes allows for more tags.",
  );
  evidence.line();
  evidence.table(
    ["Mode", "Series", "Bytes per point", "GB a month", "USD a month"],
    costRows(seriesByMode),
  );
  evidence.line(
    "Lambda and API Gateway only report in minutes with traffic, so the real figure is lower. Replace it with `cost` after a day of enrichment.",
  );

  evidence.finish();
  return status.identity.ok ? 0 : 1;
}
