import { Duration, Stack } from "aws-cdk-lib";
import type { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnPermission } from "aws-cdk-lib/aws-lambda";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

import type { AlarmActionProps } from "../../constructs/alarms/types";
import { FlexPrivateEgressFunction } from "../../constructs/lambda/flex-private-egress-function";
import { getPlatformEntry } from "../../utils/getEntry";

interface DvlaSecretRotationProps extends AlarmActionProps {
  vpc: IVpc;
  privateEgressSg: ISecurityGroup;
  dvlaSecretArn: string;
}

export function createDvlaSecretRotation(
  scope: Construct,
  {
    vpc,
    privateEgressSg,
    dvlaSecretArn,
    criticalAction,
    warningAction,
  }: DvlaSecretRotationProps,
) {
  const rotationFunction = new FlexPrivateEgressFunction(
    scope,
    "DvlaSecretRotation",
    {
      entry: getPlatformEntry("dvla-secret-rotation", "handler.ts"),
      timeout: Duration.seconds(60),
      vpc,
      privateEgressSg,
      criticalAction,
      warningAction,
      domain: "dvla",
    },
  );

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
