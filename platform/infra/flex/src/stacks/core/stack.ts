import { Environment, getEnvConfig } from "@flex/utils";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import {
  ManagedPolicy,
  PermissionsBoundary,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { Topic } from "aws-cdk-lib/aws-sns";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

import { BaseStack } from "../../base";
import { createIamChangeAlerts } from "../../constructs/alarms/iam-change-alerts";
import { createKeyChangeAlerts } from "../../constructs/alarms/key-change-alerts";
import {
  relayHealthKeyAlias,
  relayHealthTopicName,
} from "../../constructs/alarms/relay-health";
import { createLogGroupKey } from "../../constructs/kms/log-group-key";
import { ENV_KEYS } from "../../ssm-keys";
import { applyCheckovSkip } from "../../utils/applyCheckovSkip";
import { addApiGatewayCloudWatchRole } from "./api-gateway";
import { createDvlaSecretRotation } from "./dvla-secret-rotation";
import { addVpcEndpoints } from "./endpoints";
import { createSlackNotifications } from "./notifications";
import { createSecretRotationFailureAlert } from "./secret-rotation-alerts";
import { createAlarmTopics, createReleaseTopic } from "./topics";
import { createVpc } from "./vpc";

const { env, stage } = getEnvConfig();

export class FlexCoreStack extends BaseStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "flex-platform",
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

    const { logGroupKey } = createLogGroupKey(this, "alias/flex-log-group-key");

    const criticalAction = new SnsAction(criticalTopic);
    const warningAction = new SnsAction(warningTopic);

    const dvlaSecretArn = this.import(ENV_KEYS.DvlaConfigSecretArn);

    const permissionsBoundary = new ManagedPolicy(
      this,
      "DvlaRotationPermissionsBoundary",
    );
    applyCheckovSkip(
      permissionsBoundary,
      "CKV_AWS_111",
      "Permissions boundary: write actions on * are required for Lambda execution baseline (logs, X-Ray, EC2 ENI); identity-based policies constrain the actual scope",
    );
    PermissionsBoundary.of(this).apply(permissionsBoundary);

    createDvlaSecretRotation(this, {
      vpc,
      privateEgressSg: privateEgress,
      dvlaSecretArn,
      criticalAction,
      warningAction,
      permissionsBoundary,
    });

    createSecretRotationFailureAlert(this, {
      criticalTopic,
      alarmTopicKey,
      warningAction,
    });

    createIamChangeAlerts(this, {
      criticalTopic,
      alarmTopicKey,
      warningAction,
    });

    createKeyChangeAlerts(this, {
      criticalTopic,
      alarmTopicKey,
      warningAction,
    });

    // Critical alarms go to their own channel so that it stays quiet;
    // warnings keep the original channel.
    const slackWorkspaceId = this.import(ENV_KEYS.MonitoringSlackWorkspaceId);
    createSlackNotifications(this, {
      id: "SlackChannel",
      channelConfigurationName: `flex-alerts-${stage}`,
      topicKey: alarmTopicKey,
      topics: [warningTopic],
      slackWorkspaceId,
      slackChannelId: this.import(ENV_KEYS.MonitoringSlackChannelId),
    });
    // Amazon Q allows one configuration per Slack channel per account, so the
    // relay health topic that FlexGlobal creates in us-east-1 rides on this
    // configuration rather than one of its own. Its name and key alias are
    // deterministic, which avoids a circular import between the two stacks.
    const relayHealthTopic = Topic.fromTopicArn(
      this,
      "RelayHealthTopic",
      this.formatArn({
        service: "sns",
        region: "us-east-1",
        resource: relayHealthTopicName(stage),
      }),
    );
    const { role: criticalChannelRole } = createSlackNotifications(this, {
      id: "CriticalSlackChannel",
      channelConfigurationName: `flex-alerts-critical-${stage}`,
      topicKey: alarmTopicKey,
      topics: [criticalTopic, relayHealthTopic],
      slackWorkspaceId,
      slackChannelId: this.import(ENV_KEYS.MonitoringCriticalSlackChannelId),
    });
    criticalChannelRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["kms:Decrypt", "kms:GenerateDataKey"],
        resources: [
          this.formatArn({
            service: "kms",
            region: "us-east-1",
            resource: "key",
            resourceName: "*",
          }),
        ],
        conditions: {
          "ForAnyValue:StringEquals": {
            "kms:ResourceAliases": relayHealthKeyAlias(stage),
          },
        },
      }),
    );

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
      [ENV_KEYS.LogGroupKeyArn]: logGroupKey.keyArn,
      [ENV_KEYS.AlarmTopicKeyArn]: alarmTopicKey.keyArn,
    });
  }
}
