import { getEnvConfig } from "@flex/utils";
import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  type IAlarmAction,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { EventField, Rule, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { SnsTopic } from "aws-cdk-lib/aws-events-targets";
import { PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import type { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Queue, QueueEncryption } from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

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
  const eventsPrincipal = new ServicePrincipal("events.amazonaws.com");

  const deadLetterQueue = new Queue(
    scope,
    "SecretRotationAlertDeadLetterQueue",
    {
      encryption: QueueEncryption.KMS,
      encryptionMasterKey: alarmTopicKey,
      enforceSSL: true,
      retentionPeriod: Duration.days(14),
    },
  );

  const rule = new Rule(scope, "SecretRotationFailedRule", {
    description: "Alert when Secrets Manager fails to rotate a secret",
    eventPattern: {
      source: ["aws.secretsmanager"],
      detailType: ["AWS Service Event via CloudTrail"],
      detail: {
        eventName: ["RotationFailed", "TestRotationFailed"],
      },
    },
  });

  rule.addTarget(
    new SnsTopic(
      Topic.fromTopicArn(
        scope,
        "SecretRotationAlertTopic",
        criticalTopic.topicArn,
      ),
      {
        deadLetterQueue,
        message: RuleTargetInput.fromObject({
          version: "1.0",
          source: "custom",
          content: {
            textType: "client-markdown",
            title: `Secret rotation failed in ${env}`,
            description: `Secrets Manager reported \`${eventName}\` for \`${secretId}\`. The secret keeps its current value and Secrets Manager may retry, so this can repeat. Check the rotation Lambda logs, then follow the leaked secret runbook to rotate manually if needed.`,
          },
        }),
      },
    ),
  );

  criticalTopic.addToResourcePolicy(
    new PolicyStatement({
      principals: [eventsPrincipal],
      actions: ["sns:Publish"],
      resources: [criticalTopic.topicArn],
      conditions: { ArnEquals: { "aws:SourceArn": rule.ruleArn } },
    }),
  );

  alarmTopicKey.grant(eventsPrincipal, "kms:Decrypt", "kms:GenerateDataKey*");

  new Alarm(scope, "SecretRotationAlertUndelivered", {
    alarmName: `${env}-secret-rotation-alert-undelivered`,
    alarmDescription:
      "Warning: a secret rotation failure alert could not be delivered to the critical topic and is in the dead-letter queue",
    metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible({
      statistic: Stats.MAXIMUM,
      period: Duration.minutes(5),
    }),
    threshold: 0,
    evaluationPeriods: 1,
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  }).addAlarmAction(warningAction);
}
