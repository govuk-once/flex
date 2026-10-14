import { getEnvConfig } from "@flex/utils";
import type { IAlarmAction } from "aws-cdk-lib/aws-cloudwatch";
import { EventField } from "aws-cdk-lib/aws-events";
import type { Key } from "aws-cdk-lib/aws-kms";
import type { Topic } from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";

import { createEventAlert } from "../../constructs/alarms/event-alert";

const { env } = getEnvConfig();

interface SecretRotationAlertsProps {
  criticalTopic: Topic;
  alarmTopicKey: Key;
  warningAction: IAlarmAction;
}

export function createSecretRotationFailureAlert(
  scope: Construct,
  { criticalTopic, alarmTopicKey, warningAction }: SecretRotationAlertsProps,
) {
  const secretId = EventField.fromPath("$.detail.additionalEventData.SecretId");
  const eventName = EventField.fromPath("$.detail.eventName");

  createEventAlert(scope, {
    id: "SecretRotationAlert",
    name: "secret-rotation-alert",
    ruleId: "SecretRotationFailedRule",
    ruleDescription: "Alert when Secrets Manager fails to rotate a secret",
    eventPattern: {
      source: ["aws.secretsmanager"],
      detailType: ["AWS Service Event via CloudTrail"],
      detail: {
        eventName: ["RotationFailed", "TestRotationFailed"],
      },
    },
    alertDescription: "secret rotation failure alert",
    title: `Secret rotation failed in ${env}`,
    description: `Secrets Manager reported \`${eventName}\` for \`${secretId}\`. The secret keeps its current value and Secrets Manager may retry, so this can repeat. Check the rotation Lambda logs, then follow the leaked secret runbook to rotate manually if needed.`,
    criticalTopic,
    alarmTopicKey,
    warningAction,
  });
}
