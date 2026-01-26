import { Tags } from "aws-cdk-lib";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { FlexFunctionProps } from "./types";

export class FlexPublicFunction extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, functionProps: FlexFunctionProps) {
    super(scope, id);

    const logGroup = new LogGroup(this, "LogGroup", {
      retention: RetentionDays.ONE_WEEK,
    });

    this.function = new NodejsFunction(this, "Function", {
      runtime: Runtime.NODEJS_24_X,
      tracing: Tracing.ACTIVE,
      ...functionProps,
      logGroup,
    });

    if (functionProps.domain) {
      Tags.of(this.function).add("ResourceOwner", functionProps.domain, {
        priority: 200,
      });
    }
  }
}
