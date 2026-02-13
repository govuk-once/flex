import { importFlexParameter } from "@platform/core/outputs";
import { Duration } from "aws-cdk-lib";
import { IResource, LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { getGatewayEntry } from "../utils/getEntry";

function createPrivateGatewayRoute(
  path: string,
  method: string,
  handler: IFunction,
  gatewayResource: IResource,
) {
  const pathSegments = path.replace(/^\//, "").split("/").filter(Boolean);
  const resource = pathSegments.reduce(
    (parent, segment) =>
      parent.getResource(segment) ?? parent.addResource(segment),
    gatewayResource,
  );
  return resource.addMethod(method, new LambdaIntegration(handler));
}

export function createServiceGateways(
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
  const udpConnector = new FlexPrivateIsolatedFunction(scope, "UdpConnector", {
    entry: getGatewayEntry("udp", "handler.ts"),
    domain: "udp",
    environment: {
      FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN_PARAM_NAME:
        udpConsumerConfigArn.parameterName,
    },
    timeout: Duration.seconds(60), // todo
  });

  udpConsumerConfigArn.grantRead(udpConnector.function);
  udpCmk.grantDecrypt(udpConnector.function);
  udpConnector.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      resources: [udpConsumerConfigArn.stringValue],
    }),
  );

  udpConnector.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["sts:AssumeRole"],
      resources: [udpConsumerRoleArn.stringValue],
    }),
  );

  createPrivateGatewayRoute(
    "udp/{proxy+}",
    "ANY",
    udpConnector.function,
    gatewaysResource,
  );
}
