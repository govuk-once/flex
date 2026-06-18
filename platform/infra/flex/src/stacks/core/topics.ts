import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

export function createAlarmTopics(scope: Construct) {
  const cloudwatchPrincipal = new ServicePrincipal("cloudwatch.amazonaws.com");

  const alarmTopicKey = new Key(scope, "AlarmTopicKey", {
    alias: "alias/flex-alerts-key",
    description: "KMS key for alarm SNS topics",
    enableKeyRotation: true,
  });
  alarmTopicKey.grantEncryptDecrypt(cloudwatchPrincipal);

  const criticalTopic = new Topic(scope, "CriticalTopic", {
    topicName: "flex-alerts-critical",
    displayName: "flex-alerts-critical",
    masterKey: alarmTopicKey,
  });

  const warningTopic = new Topic(scope, "WarningTopic", {
    topicName: "flex-alerts-warning",
    displayName: "flex-alerts-warning",
    masterKey: alarmTopicKey,
  });

  criticalTopic.grantPublish(cloudwatchPrincipal);
  warningTopic.grantPublish(cloudwatchPrincipal);

  return { criticalTopic, warningTopic, alarmTopicKey };
}

export function createReleaseTopic(scope: Construct, alarmTopicKey: Key) {
  const releaseTopic = new Topic(scope, "ReleaseTopic", {
    topicName: "flex-release-notifications",
    displayName: "flex-release-notifications",
    masterKey: alarmTopicKey,
  });

  return { releaseTopic };
}
