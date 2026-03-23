import { Tags } from "aws-cdk-lib";
import { ISecurityGroup, IVpc, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { getEnvConfig } from "../../base/env";
import { FlexFunctionProps } from "../types";

const { stage } = getEnvConfig();

interface FlexPrivateIsolatedFunctionProps extends FlexFunctionProps {
  vpc: IVpc;
  privateIsolatedSg: ISecurityGroup;
}

export class FlexPrivateIsolatedFunction extends Construct {
  public readonly function: NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    {
      vpc,
      privateIsolatedSg,
      ...functionProps
    }: FlexPrivateIsolatedFunctionProps,
  ) {
    super(scope, id);

    const logGroup = new LogGroup(this, "LogGroup", {
      retention: RetentionDays.ONE_YEAR,
    });

    this.function = new NodejsFunction(this, "Function", {
      runtime: Runtime.NODEJS_24_X,
      tracing: Tracing.ACTIVE,
      ...functionProps,
      environment: {
        ...functionProps.environment,
        FLEX_ENVIRONMENT: stage,
        ...(stage === "production" && {
          FLEX_LOG_LEVEL_CEILING: "INFO",
        }),
      },
      logGroup,
      securityGroups: [privateIsolatedSg],
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
    });

    if (functionProps.domain) {
      Tags.of(this.function).add("ResourceOwner", functionProps.domain, {
        priority: 200,
      });
    }
  }
}
