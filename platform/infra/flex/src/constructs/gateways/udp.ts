import { Duration } from "aws-cdk-lib";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

import { createPrivateGatewayRoute } from "../../utils/createPrivateGatewayRoute";
import { getPlatformEntry } from "../../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "../lambda/flex-private-isolated-function";

interface UdpServiceGatewayProps {
  gatewaysResource: IResource;
  consumerConfigArn: string;
  cmkArn: string;
  consumerRoleArn: string;
  vpc: IVpc;
  privateIsolatedSg: ISecurityGroup;
}

export function createUdpServiceGateway(
  scope: Construct,
  {
    cmkArn,
    consumerConfigArn,
    consumerRoleArn,
    gatewaysResource,
    privateIsolatedSg,
    vpc,
  }: UdpServiceGatewayProps,
) {
  const udpCmk = Key.fromKeyArn(scope, "UdpCmk", cmkArn);
  const udpServiceGateway = new FlexPrivateIsolatedFunction(
    scope,
    "UdpServiceGateway",
    {
      entry: getPlatformEntry("udp", "handlers/service-gateway.ts"),
      domain: "udp",
      environment: {
        FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: consumerConfigArn,
      },
      timeout: Duration.seconds(30),
      privateIsolatedSg,
      vpc,
    },
  );

  udpCmk.grantDecrypt(udpServiceGateway.function);
  udpServiceGateway.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      resources: [consumerConfigArn],
    }),
  );

  udpServiceGateway.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["sts:AssumeRole"],
      resources: [consumerRoleArn],
    }),
  );

  createPrivateGatewayRoute(
    "udp/{proxy+}",
    "ANY",
    udpServiceGateway.function,
    gatewaysResource,
  );
}
