import { importVpcDetailsFromSsm } from "@platform/core/outputs";
import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { FlexFunctionProps } from "./types";

export class FlexPrivateEgressFunction extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, functionProps: FlexFunctionProps) {
    super(scope, id);

    const logGroup = new LogGroup(this, "LogGroup", {
      retention: RetentionDays.ONE_WEEK,
    });

    const { securityGroups, vpc } = importVpcDetailsFromSsm(this);

    this.function = new NodejsFunction(this, "Function", {
      runtime: Runtime.NODEJS_24_X,
      tracing: Tracing.ACTIVE,
      ...functionProps,
      logGroup,
      securityGroups: [securityGroups.privateEgress],
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
  }
}
