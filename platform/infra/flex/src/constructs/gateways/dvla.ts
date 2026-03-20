import { Duration } from "aws-cdk-lib";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

import { createPrivateGatewayRoute } from "../../utils/createPrivateGatewayRoute";
import { getPlatformEntry } from "../../utils/getEntry";
import { FlexPrivateEgressFunction } from "../lambda/flex-private-egress-function";

interface DvlaServiceGatewayProps {
  gatewaysResource: IResource;
  consumerConfigArn: string;
  vpc: IVpc;
  privateEgressSg: ISecurityGroup;
}

export function createDvlaServiceGateway(
  scope: Construct,
  {
    gatewaysResource,
    privateEgressSg,
    vpc,
    consumerConfigArn,
  }: DvlaServiceGatewayProps,
) {
  const dvlaServiceGateway = new FlexPrivateEgressFunction(
    scope,
    "dvlaServiceGateway",
    {
      entry: getPlatformEntry("dvla", "handlers/service-gateway.ts"),
      domain: "dvla",
      timeout: Duration.seconds(30),
      privateEgressSg,
      vpc,
    },
  );

  dvlaServiceGateway.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      resources: [consumerConfigArn],
    }),
  );

  createPrivateGatewayRoute(
    "dvla/{proxy+}",
    "ANY",
    dvlaServiceGateway.function,
    gatewaysResource,
  );
}
