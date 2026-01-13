import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export class FlexPrivateEgressFunction extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props?: NodejsFunctionProps) {
    super(scope, id);

    const logGroup = new LogGroup(this, "LogGroup", {
      retention: RetentionDays.ONE_WEEK,
    });

    this.function = new NodejsFunction(this, "Function", {
      runtime: Runtime.NODEJS_24_X,
      tracing: Tracing.ACTIVE,
      ...props,
      logGroup,
    });
  }
}
