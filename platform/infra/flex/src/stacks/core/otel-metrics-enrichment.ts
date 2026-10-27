import { CfnOTelEnrichment } from "aws-cdk-lib/aws-cloudwatch";
import { CfnTelemetryEnrichment } from "aws-cdk-lib/aws-observabilityadmin";
import { Construct } from "constructs";

const OTEL_METRICS_INCLUDE_FILTERS = {
  all: [],
  scoped: [{ Namespace: "AWS/Lambda" }, { Namespace: "AWS/ApiGateway" }],
} as const;

type OtelMetricsMode = keyof typeof OTEL_METRICS_INCLUDE_FILTERS;

function isOtelMetricsMode(value: string): value is OtelMetricsMode {
  return Object.keys(OTEL_METRICS_INCLUDE_FILTERS).includes(value);
}

export function resolveOtelMetricsMode(): OtelMetricsMode | undefined {
  const mode = process.env.FLEX_OTEL_METRICS;

  if (!mode) {
    return undefined;
  }

  if (!isOtelMetricsMode(mode)) {
    throw new Error(
      `FLEX_OTEL_METRICS must be one of ${Object.keys(OTEL_METRICS_INCLUDE_FILTERS).join(", ")}; received "${mode}"`,
    );
  }

  return mode;
}

export function addOtelMetricsEnrichment(scope: Construct) {
  const mode = resolveOtelMetricsMode();

  if (!mode) {
    return;
  }

  const resourceTags = new CfnTelemetryEnrichment(
    scope,
    "TelemetryResourceTags",
    { scope: "ACCOUNT" },
  );

  const otelEnrichment = new CfnOTelEnrichment(scope, "OTelMetricsEnrichment");
  otelEnrichment.addDependency(resourceTags);

  const includeFilters = OTEL_METRICS_INCLUDE_FILTERS[mode];

  if (includeFilters.length > 0) {
    otelEnrichment.addPropertyOverride("IncludeFilters", includeFilters);
  }
}
