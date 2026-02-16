import {
  importSecurityGroupFromSsm,
  importVpcFromSsm,
} from "@platform/core/outputs";
import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { FlexFunctionProps } from "../types";

export class FlexPrivateIsolatedFunction extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, functionProps: FlexFunctionProps) {
    super(scope, id);

    const logGroup = new LogGroup(this, "LogGroup", {
      retention: RetentionDays.ONE_YEAR,
    });

    const vpc = importVpcFromSsm(this, "/flex-core/vpc");
    const privateIsolated = importSecurityGroupFromSsm(
      this,
      "/flex-core/security-group/private-isolated",
    );

    this.function = new NodejsFunction(this, "Function", {
      runtime: Runtime.NODEJS_24_X,
      tracing: Tracing.ACTIVE,
      ...functionProps,
      logGroup,
      securityGroups: [privateIsolated],
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      // bundling: {
      //   nodeModules: [
      //     "@smithy/protocol-http",
      //     "@smithy/signature-v4",
      //     "@smithy/util-utf8",
      //   ],
      // },
    });

    // this.function.addToRolePolicy(
    //   new PolicyStatement({
    //     effect: Effect.ALLOW,
    //     actions: ["execute-api:Invoke"],
    //     resources: ["arn:aws:execute-api:eu-west-2:{UDP-Account}:*/*/*/*"],
    //   }),
    // );
  }
}
