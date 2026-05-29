import { Duration } from "aws-cdk-lib";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

import { createPrivateGatewayRoute } from "../../utils/createPrivateGatewayRoute";
import { getPlatformEntry } from "../../utils/getEntry";
import { AlarmActionProps } from "../alarms/types";
import { FlexPrivateEgressFunction } from "../lambda/flex-private-egress-function";

interface ServiceGatewayProps extends AlarmActionProps {
  consumerConfigArn: string;
  consumerRoleArn?: string;
  gatewaysResource: IResource;
  privateEgressSg: ISecurityGroup;
  secretArnEnvVarName: string;
  service: string;
  vpc: IVpc;
  encryptionKeyArn: string;
}

export function createServiceGateway(
  scope: Construct,
  {
    consumerConfigArn,
    consumerRoleArn,
    gatewaysResource,
    privateEgressSg,
    secretArnEnvVarName,
    service,
    vpc,
    criticalAction,
    warningAction,
    encryptionKeyArn,
  }: ServiceGatewayProps,
) {
  const serviceGateway = new FlexPrivateEgressFunction(
    scope,
    `${service}ServiceGateway`,
    {
      entry: getPlatformEntry(service, "handlers/service-gateway.ts"),
      domain: service,
      environment: {
        [secretArnEnvVarName]: consumerConfigArn,
      },
      timeout: Duration.seconds(30),
      privateEgressSg,
      vpc,
      criticalAction,
      warningAction,
    },
  );

  const secretKey = Key.fromKeyArn(
    scope,
    `secretKey${service}`,
    encryptionKeyArn,
  );
  secretKey.grantDecrypt(serviceGateway.function);

  serviceGateway.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      resources: [consumerConfigArn],
    }),
  );

  if (consumerRoleArn) {
    serviceGateway.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["sts:AssumeRole"],
        resources: [consumerRoleArn],
      }),
    );
  }

  createPrivateGatewayRoute(
    `${service}/{proxy+}`,
    "ANY",
    serviceGateway.function,
    gatewaysResource,
  );
}
