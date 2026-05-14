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

  // Allow CloudWatch from any region (including us-east-1 for CloudFront)
  // to publish to these topics.
  criticalTopic.grantPublish(cloudwatchPrincipal);
  warningTopic.grantPublish(cloudwatchPrincipal);

  /////////////////////////////////////////////////////
  // Alarm subscriptions here                        //
  // Subscribers need key access to decrypt messages //
  /////////////////////////////////////////////////////

  return { criticalTopic, warningTopic };
}
