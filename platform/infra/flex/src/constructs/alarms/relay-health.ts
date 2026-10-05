import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";

export function createRelayHealthAction(scope: Construct, stage: string) {
  const cloudwatchPrincipal = new ServicePrincipal("cloudwatch.amazonaws.com");

  const healthKey = new Key(scope, "AlarmRelayHealthKey", {
    alias: `alias/${stage}-flex-alerts-relay-health-key`,
    description: "KMS key for alarm relay health notifications",
    enableKeyRotation: true,
  });
  healthKey.grantEncryptDecrypt(cloudwatchPrincipal);

  const healthTopic = new Topic(scope, "AlarmRelayHealthTopic", {
    topicName: `${stage}-flex-alerts-relay-health`,
    displayName: `${stage}-flex-alerts-relay-health`,
    masterKey: healthKey,
  });
  healthTopic.grantPublish(cloudwatchPrincipal);

  return { healthKey, healthAction: new SnsAction(healthTopic) };
}
