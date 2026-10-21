import { getEnvConfig } from "@flex/utils";
import type { IAlarmAction } from "aws-cdk-lib/aws-cloudwatch";
import { EventField } from "aws-cdk-lib/aws-events";
import type { Key } from "aws-cdk-lib/aws-kms";
import type { Topic } from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";

import { createDeploymentExclusion } from "./deployment-exclusion";
import { createEventAlert } from "./event-alert";

const { env } = getEnvConfig();

interface KeyChangeAlertsProps {
  criticalTopic: Topic;
  alarmTopicKey: Key;
  warningAction: IAlarmAction;
}

/**
 * Every gateway call depends on KMS to decrypt a partner secret and every
 * public request depends on the Cognito user pool. A key disabled or
 * scheduled for deletion, or the pool deleted, reaches users later and gets
 * harder to recover the longer it is unnoticed, so it is critical on the
 * control plane event itself. Changes made by CloudFormation are deploys and
 * are excluded; the CloudFormation change alert already covers those.
 */
export function createKeyChangeAlerts(
  scope: Construct,
  { criticalTopic, alarmTopicKey, warningAction }: KeyChangeAlertsProps,
) {
  const eventName = EventField.fromPath("$.detail.eventName");
  const actor = EventField.fromPath("$.detail.userIdentity.arn");
  const awsRegion = EventField.fromPath("$.detail.awsRegion");
  const errorCode = EventField.fromPath("$.detail.errorCode");
  const keyId = EventField.fromPath("$.detail.requestParameters.keyId");
  const userPoolId = EventField.fromPath(
    "$.detail.requestParameters.userPoolId",
  );

  createEventAlert(scope, {
    id: "KmsKeyChangeAlert",
    name: "kms-key-change-alert",
    ruleId: "KmsKeyChangeRule",
    ruleDescription:
      "Alert when a KMS key is disabled, scheduled for deletion or has its policy changed outside a deployment",
    eventPattern: {
      source: ["aws.kms"],
      detailType: ["AWS API Call via CloudTrail"],
      detail: {
        eventSource: ["kms.amazonaws.com"],
        eventName: [
          "DisableKey",
          "ScheduleKeyDeletion",
          "PutKeyPolicy",
          "DeleteAlias",
          "DisableKeyRotation",
        ],
        ...createDeploymentExclusion(scope, {
          role: "cfn-exec",
          regions: ["eu-west-2", "us-east-1"],
        }),
      },
    },
    alertDescription: "KMS key change alert",
    title: `PLATFORM AT RISK: KMS key changed in ${env}`,
    description: `Event: \`${eventName}\`; key: \`${keyId}\`; actor: \`${actor}\`; Region: \`${awsRegion}\`; errorCode: \`${errorCode}\`. A disabled or deleted key stops FLEX decrypting secrets and configuration. Cancel a scheduled deletion with \`aws kms cancel-key-deletion\` and re-enable with \`aws kms enable-key\`. Runbook: docs/runbooks/iam-change-alert.md`,
    criticalTopic,
    alarmTopicKey,
    warningAction,
  });

  createEventAlert(scope, {
    id: "CognitoUserPoolChangeAlert",
    name: "cognito-user-pool-change-alert",
    ruleId: "CognitoUserPoolChangeRule",
    ruleDescription: "Alert when a Cognito user pool or app client is deleted",
    eventPattern: {
      source: ["aws.cognito-idp"],
      detailType: ["AWS API Call via CloudTrail"],
      detail: {
        eventSource: ["cognito-idp.amazonaws.com"],
        eventName: ["DeleteUserPool", "DeleteUserPoolClient"],
      },
    },
    alertDescription: "Cognito user pool change alert",
    title: `PLATFORM AT RISK: Cognito user pool changed in ${env}`,
    description: `Event: \`${eventName}\`; user pool: \`${userPoolId}\`; actor: \`${actor}\`; Region: \`${awsRegion}\`; errorCode: \`${errorCode}\`. Every public request is authorised against this pool, so its deletion is a full outage. Runbook: docs/runbooks/credential-monitoring-alarms.md`,
    criticalTopic,
    alarmTopicKey,
    warningAction,
  });
}
