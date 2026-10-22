import { Stack } from "aws-cdk-lib";
import { type ILayerVersion, LayerVersion } from "aws-cdk-lib/aws-lambda";
import type { Construct } from "constructs";

const OTEL_LAYER_ACCOUNT = "615299751070";
const OTEL_LAYER_NAME = "AWSOpenTelemetryDistroJs";
const OTEL_LAYER_VERSION = "16";

const OTEL_BASE_ENVIRONMENT = {
  AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument",
  OTEL_AWS_APPLICATION_SIGNALS_ENABLED: "false",
  OTEL_NODE_ENABLED_INSTRUMENTATIONS: "aws-sdk,undici",
};

const OTEL_MODE_ENVIRONMENT = {
  full: { OTEL_AWS_LAMBDA_FAST_START: "false" },
  lite: { OTEL_AWS_LAMBDA_FAST_START: "true" },
} as const;

type OtelTracingMode = keyof typeof OTEL_MODE_ENVIRONMENT;

interface OtelTracingProps {
  layers?: ILayerVersion[];
  environment?: Record<string, string>;
}

function isOtelTracingMode(value: string): value is OtelTracingMode {
  return Object.keys(OTEL_MODE_ENVIRONMENT).includes(value);
}

export function resolveOtelTracingMode(): OtelTracingMode | undefined {
  const mode = process.env.FLEX_OTEL_TRACING;

  if (!mode) {
    return undefined;
  }

  if (!isOtelTracingMode(mode)) {
    throw new Error(
      `FLEX_OTEL_TRACING must be one of ${Object.keys(OTEL_MODE_ENVIRONMENT).join(", ")}; received "${mode}"`,
    );
  }

  return mode;
}

export function getOtelTracingProps(scope: Construct): OtelTracingProps {
  const mode = resolveOtelTracingMode();

  if (!mode) {
    return {};
  }

  const { region } = Stack.of(scope);

  return {
    layers: [
      LayerVersion.fromLayerVersionArn(
        scope,
        "OtelLayer",
        `arn:aws:lambda:${region}:${OTEL_LAYER_ACCOUNT}:layer:${OTEL_LAYER_NAME}:${OTEL_LAYER_VERSION}`,
      ),
    ],
    environment: {
      ...OTEL_BASE_ENVIRONMENT,
      ...OTEL_MODE_ENVIRONMENT[mode],
    },
  };
}
