import { importFlexParameter } from "@platform/core/outputs";
import { Duration } from "aws-cdk-lib";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

import { createPrivateGatewayRoute } from "../../utils/createPrivateGatewayRoute";
import { getPlatformEntry } from "../../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "../lambda/flex-private-isolated-function";

export function createUdpServiceGateway(
  scope: Construct,
  gatewaysResource: IResource,
) {
  const udpConsumerConfigArn = importFlexParameter(
    scope,
    "/flex-param/udp/consumer-config-secret-arn",
  );
  const udpCmkArn = importFlexParameter(scope, "/flex-param/udp/cmk-arn");
  const udpConsumerRoleArn = importFlexParameter(
    scope,
    "/flex-param/udp/consumer-role-arn",
  );
  const udpCmk = Key.fromKeyArn(scope, "UdpCmk", udpCmkArn.stringValue);
  const udpServiceGateway = new FlexPrivateIsolatedFunction(
    scope,
    "UdpServiceGateway",
    {
      entry: getPlatformEntry("udp", "handlers/service-gateway.ts"),
      domain: "udp",
      environment: {
        FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN_PARAM_NAME:
          udpConsumerConfigArn.parameterName,
      },
      timeout: Duration.seconds(10),
    },
  );

  udpConsumerConfigArn.grantRead(udpServiceGateway.function);
  udpCmk.grantDecrypt(udpServiceGateway.function);
  udpServiceGateway.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      resources: [udpConsumerConfigArn.stringValue],
    }),
  );

  udpServiceGateway.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["sts:AssumeRole"],
      resources: [udpConsumerRoleArn.stringValue],
    }),
  );

  createPrivateGatewayRoute(
    "udp/{proxy+}",
    "ANY",
    udpServiceGateway.function,
    gatewaysResource,
  );
}
