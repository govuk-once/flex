import { getEnvConfig } from "@flex/utils";
import { Duration } from "aws-cdk-lib";
import { type IAlarmAction, Metric, Stats } from "aws-cdk-lib/aws-cloudwatch";
import {
  type EventPattern,
  Rule,
  RuleTargetInput,
} from "aws-cdk-lib/aws-events";
import { SnsTopic } from "aws-cdk-lib/aws-events-targets";
import { PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Queue, QueueEncryption } from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

import { createAboveZeroAlarm } from "./above-zero-alarm";

const { env } = getEnvConfig();

const ALARM_PERIOD = Duration.minutes(5);

interface EventAlertProps {
  id: string;
  name: string;
  ruleId: string;
  ruleDescription: string;
  eventPattern: EventPattern;
  alertDescription: string;
  title: string;
  description: string;
  criticalTopic: Topic;
  alarmTopicKey?: Key;
  warningAction: IAlarmAction;
}

export function createEventAlert(
  scope: Construct,
  {
    id,
    name,
    ruleId,
    ruleDescription,
    eventPattern,
    alertDescription,
    title,
    description,
    criticalTopic,
    alarmTopicKey,
    warningAction,
  }: EventAlertProps,
) {
  const eventsPrincipal = new ServicePrincipal("events.amazonaws.com");

  const deadLetterQueueKey = new Key(scope, `${id}DeadLetterQueueKey`, {
    alias: `alias/${env}-flex-${name}-dlq-key`,
    description: `KMS key for undelivered ${alertDescription}s, separate from the alarm topic key`,
    enableKeyRotation: true,
  });

  const deadLetterQueue = new Queue(scope, `${id}DeadLetterQueue`, {
    encryption: QueueEncryption.KMS,
    encryptionMasterKey: deadLetterQueueKey,
    enforceSSL: true,
    retentionPeriod: Duration.days(14),
  });

  const rule = new Rule(scope, ruleId, {
    description: ruleDescription,
    eventPattern,
  });

  rule.addTarget(
    new SnsTopic(
      Topic.fromTopicArn(scope, `${id}Topic`, criticalTopic.topicArn),
      {
        deadLetterQueue,
        message: RuleTargetInput.fromObject({
          version: "1.0",
          source: "custom",
          content: {
            textType: "client-markdown",
            title,
            description,
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

  [alarmTopicKey, deadLetterQueueKey]
    .filter((key) => key !== undefined)
    .forEach((key) =>
      key.grant(eventsPrincipal, "kms:Decrypt", "kms:GenerateDataKey*"),
    );

  [
    {
      id: `${id}Undelivered`,
      alarmName: `${env}-${name}-undelivered`,
      alarmDescription: `Warning: a ${alertDescription} could not be delivered to the critical topic and is in the dead-letter queue`,
      metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        statistic: Stats.MAXIMUM,
        period: ALARM_PERIOD,
      }),
    },
    {
      id: `${id}Lost`,
      alarmName: `${env}-${name}-lost`,
      alarmDescription: `Warning: a ${alertDescription} could not be delivered to the critical topic or to the dead-letter queue, so it is lost`,
      metric: new Metric({
        namespace: "AWS/Events",
        metricName: "InvocationsFailedToBeSentToDlq",
        dimensionsMap: { RuleName: rule.ruleName },
        statistic: Stats.SUM,
        period: ALARM_PERIOD,
      }),
    },
  ].forEach((alarm) =>
    createAboveZeroAlarm(scope, { ...alarm, action: warningAction }),
  );

  return rule;
}
