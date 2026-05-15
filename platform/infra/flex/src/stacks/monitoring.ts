import { getEnvConfig } from "@flex/utils";
import { SlackChannelConfiguration } from "aws-cdk-lib/aws-chatbot";
import { ManagedPolicy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
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

    const workspaceLookup = new AwsCustomResource(
      this,
      "SlackWorkspaceLookup",
      {
        onUpdate: {
          service: "chatbot",
          action: "DescribeSlackWorkspaces",
          region: "us-east-2",
          physicalResourceId: PhysicalResourceId.of(
            "flex-slack-workspace-lookup",
          ),
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      },
    );

    const slackWorkspaceId = workspaceLookup.getResponseField(
      "SlackWorkspaces.0.SlackTeamId",
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

    severities.forEach(({ name, ssmKey }) => {
      const topic = Topic.fromTopicArn(
        this,
        `Topic-${name}`,
        this.import(ssmKey, "eu-west-2"),
      );

      const slack = new SlackChannelConfiguration(this, `Slack-${name}`, {
        slackChannelConfigurationName: `flex-alerts-${stage}-${name}`,
        slackWorkspaceId,
        slackChannelId,
        notificationTopics: [topic],
        guardrailPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess"),
        ],
      });

      if (!slack.role) {
        throw new Error(
          `SlackChannelConfiguration Slack-${name} has no role; cannot grant KMS decrypt`,
        );
      }
      slack.role.addToPrincipalPolicy(
        new PolicyStatement({
          actions: ["kms:Decrypt", "kms:GenerateDataKey"],
          resources: [coreKey.keyArn],
        }),
      );
    });
  }
}
