import { formatNumber } from "../analysis";
import { awsJson } from "../awsCli";
import type { Evidence } from "../evidence";
import type { Options } from "../options";

interface CostGroup {
  Keys?: string[];
  Metrics?: Record<string, { Amount?: string; Unit?: string }>;
}

interface CostResponse {
  ResultsByTime?: { TimePeriod?: { Start?: string }; Groups?: CostGroup[] }[];
}

const OTEL_HINT = /otel|enrich|promql|telemetry/i;

function isoDay(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function rowsFrom(response: CostResponse): string[][] {
  return (response.ResultsByTime ?? []).flatMap((period) =>
    (period.Groups ?? [])
      .filter(
        (group) => Number(group.Metrics?.UnblendedCost?.Amount ?? 0) !== 0,
      )
      .map((group) => {
        const usageType = group.Keys?.[0] ?? "?";
        return [
          period.TimePeriod?.Start ?? "?",
          usageType,
          OTEL_HINT.test(usageType) ? "yes" : "",
          `${formatNumber(Number(group.Metrics?.UsageQuantity?.Amount ?? 0), 4)} ${group.Metrics?.UsageQuantity?.Unit ?? ""}`,
          formatNumber(Number(group.Metrics?.UnblendedCost?.Amount ?? 0), 4),
        ];
      }),
  );
}

export function cost(options: Options, evidence: Evidence): number {
  const start = isoDay(options.days);
  const end = isoDay(0);
  const response = awsJson<CostResponse>("us-east-1", [
    "ce",
    "get-cost-and-usage",
    "--time-period",
    `Start=${start},End=${end}`,
    "--granularity",
    "DAILY",
    "--metrics",
    "UsageQuantity",
    "UnblendedCost",
    "--filter",
    JSON.stringify({
      Dimensions: { Key: "SERVICE", Values: ["AmazonCloudWatch"] },
    }),
    "--group-by",
    "Type=DIMENSION,Key=USAGE_TYPE",
  ]);
  evidence.save("cost-and-usage.json", response);

  evidence.line(
    `# OTel metrics spike: CloudWatch cost by usage type, ${start} to ${end}`,
  );
  evidence.line();
  evidence.line(
    `Run at ${new Date().toISOString()}. Cost Explorer data lags by up to a day.`,
  );
  evidence.line();
  if (!response.ok) {
    evidence.line(`get-cost-and-usage failed: ${response.error}`);
    evidence.finish();
    return 1;
  }
  evidence.table(
    ["Day", "Usage type", "Looks like OTel", "Usage", "USD"],
    rowsFrom(response.value),
  );
  evidence.line(
    "Compare the days before and after `enable`. A usage type that appears only after it is the enrichment charge, whatever it is called.",
  );
  evidence.finish();
  return 0;
}
