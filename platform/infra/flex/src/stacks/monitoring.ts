import { getEnvConfig } from "@flex/utils";
import { SlackChannelConfiguration } from "aws-cdk-lib/aws-chatbot";
import { ManagedPolicy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { ENV_KEYS } from "../ssm-keys";

const { persistent, stage } = getEnvConfig();

export class FlexMonitoringStack extends BaseStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: { region: "eu-west-2" },
    });

    if (!persistent) return;

    const slackWorkspaceId = this.import(
      ENV_KEYS.MonitoringSlackWorkspaceId,
      "eu-west-2",
    );
    const slackChannelId = this.import(
      ENV_KEYS.MonitoringSlackChannelId,
      "eu-west-2",
    );

    const coreKey = Key.fromLookup(this, "CoreAlarmKey", {
      aliasName: "alias/flex-alerts-key",
    });

    const severities = [
      { name: "critical", ssmKey: ENV_KEYS.TopicCriticalAlarms },
      { name: "warning", ssmKey: ENV_KEYS.TopicWarningAlarms },
    ] as const;

    const notificationTopics = severities.map(({ name, ssmKey }) =>
      Topic.fromTopicArn(
        this,
        `Topic-${name}`,
        this.import(ssmKey, "eu-west-2"),
      ),
    );

    const slack = new SlackChannelConfiguration(this, "Slack", {
      slackChannelConfigurationName: `flex-alerts-${stage}`,
      slackWorkspaceId,
      slackChannelId,
      notificationTopics,
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
        resources: [coreKey.keyArn],
      }),
    );
  }
}
