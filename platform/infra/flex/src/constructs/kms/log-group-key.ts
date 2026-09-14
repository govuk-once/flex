import { ArnFormat, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

import { LOG_GROUP_KEY_ID } from "../../utils/logs";

export function createLogGroupKey(scope: Construct, alias: string) {
  const stack = Stack.of(scope);

  const logGroupKey = new Key(scope, LOG_GROUP_KEY_ID, {
    alias,
    description: "KMS key for CloudWatch log group encryption",
    enableKeyRotation: true,
  });

  logGroupKey.addToResourcePolicy(
    new PolicyStatement({
      sid: "AllowCloudWatchLogsUse",
      effect: Effect.ALLOW,
      principals: [new ServicePrincipal(`logs.${stack.region}.amazonaws.com`)],
      actions: [
        "kms:Encrypt*",
        "kms:Decrypt*",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:Describe*",
      ],
      resources: ["*"],
      conditions: {
        ArnLike: {
          "kms:EncryptionContext:aws:logs:arn": stack.formatArn({
            service: "logs",
            resource: "log-group",
            resourceName: "*",
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        },
      },
    }),
  );

  return { logGroupKey };
}
