import { Duration } from "aws-cdk-lib";
import { type IAlarmAction, Stats } from "aws-cdk-lib/aws-cloudwatch";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { IKey } from "aws-cdk-lib/aws-kms";
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { SqsDestination } from "aws-cdk-lib/aws-lambda-destinations";
import { Topic } from "aws-cdk-lib/aws-sns";
import { LambdaSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { Queue, QueueEncryption } from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

import { createAboveZeroAlarm } from "./above-zero-alarm";
import { RELAY_HANDLER_CODE } from "./relay-handler";

const ALARM_PERIOD = Duration.minutes(5);

export interface AlarmRelayProps {
  readonly severity: "Critical" | "Warning";
  readonly stage: string;
  readonly targetTopicArn: string;
  readonly targetTopicKeyArn: string;
  readonly relayTopicKey: IKey;
  readonly healthKey: IKey;
  readonly healthAction: IAlarmAction;
}

export function createAlarmRelay(
  scope: Construct,
  {
    severity,
    stage,
    targetTopicArn,
    targetTopicKeyArn,
    relayTopicKey,
    healthKey,
    healthAction,
  }: AlarmRelayProps,
) {
  const relayName = `${stage}-flex-alarm-relay-${severity.toLowerCase()}`;

  const failureQueue = new Queue(scope, `${severity}RelayFailureQueue`, {
    queueName: `${relayName}-failures`,
    encryption: QueueEncryption.KMS,
    encryptionMasterKey: healthKey,
    enforceSSL: true,
    retentionPeriod: Duration.days(14),
  });

  const relayTopic = new Topic(scope, `${severity}RelayTopic`, {
    masterKey: relayTopicKey,
  });

  const relayFn = new LambdaFunction(scope, `${severity}RelayFn`, {
    runtime: Runtime.NODEJS_24_X,
    handler: "index.handler",
    timeout: Duration.seconds(10),
    environment: {
      TARGET_TOPIC_ARN: targetTopicArn,
    },
    code: Code.fromInline(RELAY_HANDLER_CODE),
    onFailure: new SqsDestination(failureQueue),
  });

  relayFn.addToRolePolicy(
    new PolicyStatement({
      actions: ["sns:Publish"],
      resources: [targetTopicArn],
    }),
  );

  relayFn.addToRolePolicy(
    new PolicyStatement({
      actions: ["kms:GenerateDataKey*", "kms:Decrypt"],
      resources: [targetTopicKeyArn],
    }),
  );

  relayTopic.addSubscription(new LambdaSubscription(relayFn));

  [
    {
      id: `${severity}RelayErrors`,
      alarmName: `${relayName}-errors`,
      alarmDescription: `The ${severity.toLowerCase()} alarm relay failed to forward a notification to eu-west-2. Lambda retries twice, then sends the notification to the failure queue`,
      metric: relayFn.metricErrors({
        statistic: Stats.SUM,
        period: ALARM_PERIOD,
      }),
    },
    {
      id: `${severity}RelayFailureQueueNotEmpty`,
      alarmName: `${relayName}-failure-queue-not-empty`,
      alarmDescription: `The ${severity.toLowerCase()} alarm relay gave up on a notification and it is waiting in the failure queue to be replayed`,
      metric: failureQueue.metricApproximateNumberOfMessagesVisible({
        statistic: Stats.MAXIMUM,
        period: ALARM_PERIOD,
      }),
    },
    {
      id: `${severity}RelayFailureQueueUndelivered`,
      alarmName: `${relayName}-failure-queue-undelivered`,
      alarmDescription: `The ${severity.toLowerCase()} alarm relay gave up on a notification and could not send it to the failure queue, so the notification is lost`,
      metric: relayFn.metric("DestinationDeliveryFailures", {
        statistic: Stats.SUM,
        period: ALARM_PERIOD,
      }),
    },
  ].forEach((alarm) =>
    createAboveZeroAlarm(scope, { ...alarm, action: healthAction }),
  );

  return relayTopic;
}
