import {
  importSecurityGroupFromSsm,
  importVpcFromSsm,
} from "@platform/core/outputs";
import { Tags } from "aws-cdk-lib";
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

    const vpc = importVpcFromSsm(this, "/flex-core/vpc");
    const privateEgressSg = importSecurityGroupFromSsm(
      this,
      "/flex-core/security-group/private-egress",
    );

    this.function = new NodejsFunction(this, "Function", {
      runtime: Runtime.NODEJS_24_X,
      tracing: Tracing.ACTIVE,
      ...functionProps,
      logGroup,
      securityGroups: [privateEgressSg],
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    if (functionProps.domain) {
      Tags.of(this.function).add("ResourceOwner", functionProps.domain, {
        priority: 200,
      });
    }
  }
}
