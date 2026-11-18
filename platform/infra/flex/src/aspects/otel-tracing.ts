import { IAspect, Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnFunction, LayerVersion, Tracing } from "aws-cdk-lib/aws-lambda";
import { IConstruct } from "constructs";

import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";

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

export class EnableOtelTracing implements IAspect {
  private readonly mode = resolveOtelTracingMode();

  public visit(node: IConstruct): void {
    if (
      !this.mode ||
      !(
        node instanceof FlexPublicFunction ||
        node instanceof FlexPrivateEgressFunction ||
        node instanceof FlexPrivateIsolatedFunction
      )
    ) {
      return;
    }

    const fn = node.function;
    const { region } = Stack.of(fn);

    fn.addLayers(
      LayerVersion.fromLayerVersionArn(
        fn,
        "OtelLayer",
        `arn:aws:lambda:${region}:${OTEL_LAYER_ACCOUNT}:layer:${OTEL_LAYER_NAME}:${OTEL_LAYER_VERSION}`,
      ),
    );

    for (const [key, value] of Object.entries({
      ...OTEL_BASE_ENVIRONMENT,
      ...OTEL_MODE_ENVIRONMENT[this.mode],
    })) {
      fn.addEnvironment(key, value);
    }

    // Spans are exported through the X-Ray daemon, so active tracing is forced on
    const cfnFunction = fn.node.defaultChild as CfnFunction;
    if (cfnFunction.tracingConfig === undefined) {
      cfnFunction.tracingConfig = { mode: Tracing.ACTIVE };
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ["xray:PutTraceSegments", "xray:PutTelemetryRecords"],
          resources: ["*"],
        }),
      );
    }
  }
}
