import { Environment, getEnvConfig } from "@flex/utils";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

import { BaseStack } from "../../base";
import { ENV_KEYS } from "../../ssm-keys";
import { addApiGatewayCloudWatchRole } from "./api-gateway";
import { createDvlaSecretRotation } from "./dvla-secret-rotation";
import { addVpcEndpoints } from "./endpoints";
import { createSlackNotifications } from "./notifications";
import { createAlarmTopics, createReleaseTopic } from "./topics";
import { createVpc } from "./vpc";

const { env, stage } = getEnvConfig();

export class FlexCoreStack extends BaseStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "eu-west-2",
      },
    });

    this.terminationProtection = true;
    addApiGatewayCloudWatchRole(this);

    const {
      securityGroups: { privateEgress, privateIsolated },
      vpc,
    } = createVpc(this);

    const { apiGatewayEndpoint } = addVpcEndpoints({
      vpc,
      securityGroup: privateIsolated,
    });

    const { criticalTopic, warningTopic, alarmTopicKey } =
      createAlarmTopics(this);

    const criticalAction = new SnsAction(criticalTopic);
    const warningAction = new SnsAction(warningTopic);

    const dvlaSecretArn = this.import(ENV_KEYS.DvlaConfigSecretArn);

    createDvlaSecretRotation(this, {
      vpc,
      privateEgressSg: privateEgress,
      dvlaSecretArn,
      criticalAction,
      warningAction,
    });

    createSlackNotifications(this, {
      id: "SlackChannel",
      channelConfigurationName: `flex-alerts-${stage}`,
      topicKey: alarmTopicKey,
      topics: [warningTopic, criticalTopic],
      slackWorkspaceId: this.import(ENV_KEYS.MonitoringSlackWorkspaceId),
      slackChannelId: this.import(ENV_KEYS.MonitoringSlackChannelId),
    });

    // Release notifications are published once per pipeline run, so the
    // topic and channel config only exist in the development environment
    if (env === Environment.development) {
      const { releaseTopic } = createReleaseTopic(this, alarmTopicKey);

      // Resolved at synth time
      const releaseChannelIds = StringParameter.valueFromLookup(
        this,
        ENV_KEYS.ReleaseSlackChannelId,
      )
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      const slackWorkspaceId = this.import(ENV_KEYS.MonitoringSlackWorkspaceId);
      releaseChannelIds.forEach((slackChannelId) => {
        createSlackNotifications(this, {
          id: `ReleaseSlackChannel${slackChannelId}`,
          channelConfigurationName: `flex-releases-${stage}-${slackChannelId}`,
          topicKey: alarmTopicKey,
          topics: [releaseTopic],
          slackWorkspaceId,
          slackChannelId,
        });
      });

      this.exports({
        [ENV_KEYS.TopicReleaseNotifications]: releaseTopic.topicArn,
      });
    }

    this.exportVpc(ENV_KEYS.Vpc, vpc);
    this.exports({
      [ENV_KEYS.SgPrivateEgress]: privateEgress.securityGroupId,
      [ENV_KEYS.SgPrivateIsolated]: privateIsolated.securityGroupId,
      [ENV_KEYS.TopicCriticalAlarms]: criticalTopic.topicArn,
      [ENV_KEYS.TopicWarningAlarms]: warningTopic.topicArn,
      [ENV_KEYS.VpcEApiGateway]: apiGatewayEndpoint.vpcEndpointId,
    });
  }
}
