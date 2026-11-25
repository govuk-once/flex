export interface ApiTarget {
  apiName: string;
  apiStage: string;
  method: string;
  resource: string;
}

export type LambdaSeriesVariant = "all-series" | "function-only";

export const LAMBDA_VARIANTS: LambdaSeriesVariant[] = [
  "all-series",
  "function-only",
];

const LAMBDA_SCOPE = `"@instrumentation.@name"="cloudwatch.aws/lambda"`;
const API_SCOPE = `"@instrumentation.@name"="cloudwatch.aws/apigateway"`;

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, String.raw`\"`);
}

function matcher(name: string, value: string): string {
  return `"${name}"="${escapeLabelValue(value)}"`;
}

function variantMatcher(variant: LambdaSeriesVariant): string {
  return variant === "function-only" ? `, Resource=""` : "";
}

export function apiLatencyQuantile(
  quantile: number,
  target: ApiTarget,
): string {
  const selector = [
    "LatencyByMethod",
    API_SCOPE,
    matcher("ApiName", target.apiName),
    matcher("Stage", target.apiStage),
    matcher("Method", target.method),
    matcher("Resource", target.resource),
  ].join(", ");
  return `histogram_quantile(${String(quantile)}, sum_over_time({${selector}}[5m]))`;
}

export function lambdaSeriesSelector(stage: string): string {
  return `{Duration, ${LAMBDA_SCOPE}, ${matcher("@aws.tag.Stage", stage)}}`;
}

export function lambdaDurationByDomain(
  quantile: number,
  stage: string,
  variant: LambdaSeriesVariant,
): string {
  return `histogram_quantile(${String(quantile)}, sum by ("@aws.tag.ResourceOwner") (sum_over_time({Duration, ${LAMBDA_SCOPE}, ${matcher("@aws.tag.Stage", stage)}${variantMatcher(variant)}}[5m])))`;
}

export function lambdaInvocationsByDomain(
  stage: string,
  window: string,
  variant: LambdaSeriesVariant,
): string {
  return `sum by ("@aws.tag.ResourceOwner") (sum_over_time({Invocations, ${LAMBDA_SCOPE}, ${matcher("@aws.tag.Stage", stage)}${variantMatcher(variant)}}[${window}]))`;
}

export function lambdaErrorsByStage(
  window: string,
  variant: LambdaSeriesVariant,
): string {
  return `sum by ("@aws.tag.Stage") (sum_over_time({Errors, ${LAMBDA_SCOPE}${variantMatcher(variant)}}[${window}]))`;
}

export function metricsInsightsInvocationsByDomain(stage: string): string {
  return `SELECT SUM(Invocations) FROM SCHEMA("AWS/Lambda", FunctionName) WHERE tag.Stage = '${stage.replace(/'/g, "''")}' GROUP BY tag.ResourceOwner`;
}
