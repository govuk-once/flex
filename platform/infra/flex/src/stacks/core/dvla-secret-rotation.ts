import { Duration, Stack } from "aws-cdk-lib";
import type { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import {
  Effect,
  type ManagedPolicy,
  PolicyStatement,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { CfnPermission } from "aws-cdk-lib/aws-lambda";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

import type { AlarmActionProps } from "../../constructs/alarms/types";
import { FlexPrivateEgressFunction } from "../../constructs/lambda/flex-private-egress-function";
import { ENV_KEYS } from "../../ssm-keys";
import { getPlatformEntry } from "../../utils/getEntry";

interface DvlaSecretRotationProps extends AlarmActionProps {
  vpc: IVpc;
  privateEgressSg: ISecurityGroup;
  dvlaSecretArn: string;
  permissionsBoundary: ManagedPolicy;
}

export function createDvlaSecretRotation(
  scope: Construct,
  {
    vpc,
    privateEgressSg,
    dvlaSecretArn,
    criticalAction,
    warningAction,
    permissionsBoundary,
  }: DvlaSecretRotationProps,
) {
  const rotationFunction = new FlexPrivateEgressFunction(
    scope,
    "DvlaSecretRotation",
    {
      entry: getPlatformEntry("dvla-secret-rotation", "handler.ts"),
      timeout: Duration.seconds(60),
      // Disable retries as if it fails it is in a broken state and can't be retried
      retryAttempts: 0,
      vpc,
      privateEgressSg,
      criticalAction,
      warningAction,
      domain: "dvla",
    },
  );

  const secretEncryptionKeyArn = StringParameter.valueForStringParameter(
    scope,
    ENV_KEYS.FlexEncryptionKey,
  );
  const secretEncryptionKey = Key.fromKeyArn(
    scope,
    "DvlaSecretEncryptionKey",
    secretEncryptionKeyArn,
  );
  secretEncryptionKey.grantEncryptDecrypt(rotationFunction.function);

  rotationFunction.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:UpdateSecretVersionStage",
      ],
      resources: [dvlaSecretArn],
    }),
  );

  permissionsBoundary.addStatements(
    new PolicyStatement({
      sid: "AllowDvlaSecretRotationWrite",
      effect: Effect.ALLOW,
      actions: [
        "secretsmanager:PutSecretValue",
        "secretsmanager:UpdateSecretVersionStage",
      ],
      resources: [dvlaSecretArn],
    }),
    new PolicyStatement({
      sid: "AllowDvlaSecretRotationKms",
      effect: Effect.ALLOW,
      actions: [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey",
      ],
      resources: [secretEncryptionKeyArn],
    }),
  );

  const dvlaSecret = Secret.fromSecretCompleteArn(
    scope,
    "DvlaConfigSecret",
    dvlaSecretArn,
  );

  dvlaSecret.addRotationSchedule("DvlaRotationSchedule", {
    rotationLambda: rotationFunction.function,
    automaticallyAfter: Duration.days(30),
  });

  rotationFunction.function.addPermission("SecretsManagerInvoke", {
    principal: new ServicePrincipal("secretsmanager.amazonaws.com"),
    action: "lambda:InvokeFunction",
    sourceAccount: Stack.of(scope).account,
  });

  const cdkAutoPermission = rotationFunction.function.permissionsNode.children
    .filter((child): child is CfnPermission => child instanceof CfnPermission)
    .find((p) => p.node.id !== "SecretsManagerInvoke");

  if (cdkAutoPermission) {
    cdkAutoPermission.addPropertyOverride(
      "SourceAccount",
      Stack.of(scope).account,
    );
  }

  return { rotationFunction };
}
