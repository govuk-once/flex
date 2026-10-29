import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";

/**
 * The names are deterministic so that FlexCore, in eu-west-2, can subscribe
 * the topic to Slack without importing anything from FlexGlobal.
 */
export const relayHealthTopicName = (stage: string) =>
  `${stage}-flex-alerts-relay-health`;
export const relayHealthKeyAlias = (stage: string) =>
  `alias/${stage}-flex-alerts-relay-health-key`;

export function createRelayHealthAction(scope: Construct, stage: string) {
  const cloudwatchPrincipal = new ServicePrincipal("cloudwatch.amazonaws.com");

  const healthKey = new Key(scope, "AlarmRelayHealthKey", {
    alias: relayHealthKeyAlias(stage),
    description: "KMS key for alarm relay health notifications",
    enableKeyRotation: true,
  });
  healthKey.grantEncryptDecrypt(cloudwatchPrincipal);

  const healthTopic = new Topic(scope, "AlarmRelayHealthTopic", {
    topicName: relayHealthTopicName(stage),
    displayName: relayHealthTopicName(stage),
    masterKey: healthKey,
  });
  healthTopic.grantPublish(cloudwatchPrincipal);

  return { healthKey, healthAction: new SnsAction(healthTopic) };
}
