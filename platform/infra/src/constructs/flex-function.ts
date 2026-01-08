import { Duration } from "aws-cdk-lib";
import type { AssetCode, InlineCode } from "aws-cdk-lib/aws-lambda";
import { Function, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import type { LogGroupProps } from "aws-cdk-lib/aws-logs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface FlexFunctionProps {
  readonly handler: {
    readonly code: AssetCode | InlineCode;
    readonly description?: string;
    readonly environment?: Record<string, string>;
    readonly memorySize?: number;
    readonly name?: string;
    readonly runtime?: Runtime;
    readonly tracing?: Tracing;
    readonly timeout?: Duration;
  };
  readonly logGroup?: LogGroupProps;
}

export class FlexFunction extends Construct {
  public readonly handler: Function;
  public readonly logGroup: LogGroup;

  constructor(scope: Construct, id: string, props: FlexFunctionProps) {
    super(scope, id);

    const {
      handler: {
        code,
        description,
        environment,
        memorySize,
        name = "handler",
        runtime = Runtime.NODEJS_24_X,
        timeout,
        tracing = Tracing.ACTIVE,
      },
      logGroup: logGroupProps,
    } = props;

    this.logGroup = new LogGroup(this, "LogGroup", {
      retention: RetentionDays.ONE_WEEK,
      ...logGroupProps,
    });

    this.handler = new Function(this, "Handler", {
      code,
      description,
      environment,
      handler: name,
      logGroup: this.logGroup,
      memorySize,
      runtime,
      timeout,
      tracing,
    });
  }
}
