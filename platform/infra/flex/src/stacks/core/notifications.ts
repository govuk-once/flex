import { getEnvConfig } from "@flex/utils";
import { SlackChannelConfiguration } from "aws-cdk-lib/aws-chatbot";
import { ManagedPolicy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

const { stage } = getEnvConfig();

interface NotificationsProps {
  alarmTopicKey: Key;
  topics: Topic[];
  slackWorkspaceId: string;
  slackChannelId: string;
}

export function createSlackNotifications(
  scope: Construct,
  {
    alarmTopicKey,
    topics,
    slackWorkspaceId,
    slackChannelId,
  }: NotificationsProps,
) {
  const slack = new SlackChannelConfiguration(scope, "SlackChannel", {
    slackChannelConfigurationName: `flex-alerts-${stage}`,
    slackWorkspaceId,
    slackChannelId,
    notificationTopics: topics,
    guardrailPolicies: [
      ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess"),
    ],
  });

  if (!slack.role) {
    throw new Error(
      "SlackChannelConfiguration has no role; cannot grant KMS decrypt",
    );
  }
  slack.role.addToPrincipalPolicy(
    new PolicyStatement({
      actions: ["kms:Decrypt", "kms:GenerateDataKey"],
      resources: [alarmTopicKey.keyArn],
    }),
  );
}
