import { Duration } from "aws-cdk-lib";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

import { createPrivateGatewayRoute } from "../../utils/createPrivateGatewayRoute";
import { getPlatformEntry } from "../../utils/getEntry";
import { AlarmActionProps } from "../alarms/types";
import { FlexPrivateIsolatedFunction } from "../lambda/flex-private-isolated-function";

interface UnsServiceGatewayProps extends AlarmActionProps {
  gatewaysResource: IResource;
  consumerConfigArn: string;
  consumerRoleArn: string;
  vpc: IVpc;
  privateIsolatedSg: ISecurityGroup;
  encryptionKeyArn: string;
}

export function createUnsServiceGateway(
  scope: Construct,
  {
    consumerConfigArn,
    consumerRoleArn,
    gatewaysResource,
    privateIsolatedSg,
    vpc,
    criticalAction,
    warningAction,
    encryptionKeyArn,
  }: UnsServiceGatewayProps,
) {
  consumerConfigArn =
    "arn:aws:secretsmanager:eu-west-2:674663567518:secret:uns-dev/flex/consumer-dC41Ci";
  const unsServiceGateway = new FlexPrivateIsolatedFunction(
    scope,
    "unsPrivateServiceGateway",
    {
      entry: getPlatformEntry("uns", "handlers/service-gateway.ts"),
      domain: "uns",
      environment: {
        FLEX_UNS_CONSUMER_CONFIG_SECRET_ARN: consumerConfigArn,
      },
      timeout: Duration.seconds(30),
      privateIsolatedSg,
      vpc,
      criticalAction,
      warningAction,
    },
  );

  const kmsKey = Key.fromKeyArn(scope, `encryptionKeyArnUns`, encryptionKeyArn);
  kmsKey.grantDecrypt(unsServiceGateway.function);

  unsServiceGateway.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      resources: [consumerConfigArn],
    }),
  );

  unsServiceGateway.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["sts:AssumeRole"],
      resources: [consumerRoleArn],
    }),
  );

  createPrivateGatewayRoute(
    "uns/{proxy+}",
    "ANY",
    unsServiceGateway.function,
    gatewaysResource,
  );
}
