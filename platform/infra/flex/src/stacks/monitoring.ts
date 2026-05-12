import { Environment, getEnvConfig } from "@flex/utils";
import { Duration } from "aws-cdk-lib";
import { SlackChannelConfiguration } from "aws-cdk-lib/aws-chatbot";
import {
  Alarm,
  ComparisonOperator,
  Metric,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import {
  ManagedPolicy,
  PolicyStatement,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { BaseStackProps } from "../base/types";
import { ENV_KEYS, STAGE_KEYS } from "../ssm-keys";

type SupportedRegion = BaseStackProps["env"]["region"];

interface FlexMonitoringStackProps {
  region: SupportedRegion;
}

interface MonitoringConfig {
  workspaceId?: string;
  channelId?: string;
  channelIdCritical?: string;
  channelIdWarning?: string;
}

type ChannelField = "channelId" | "channelIdCritical" | "channelIdWarning";

interface TopicSpec {
  suffix: "default" | "critical" | "warning";
  topicName: string;
  ssmKey: string;
  channelField: ChannelField;
}

const { env, stage, persistent } = getEnvConfig();

function buildTopicSpecs(region: string): TopicSpec[] {
  const defaultSpec: TopicSpec = {
    suffix: "default",
    topicName: `flex-alerts-${stage}-${region}`,
    ssmKey: STAGE_KEYS.AlertTopicArn,
    channelField: "channelId",
  };

  if (env !== Environment.production) return [defaultSpec];

  return [
    defaultSpec,
    {
      suffix: "critical",
      topicName: `flex-alerts-prod-critical-${region}`,
      ssmKey: STAGE_KEYS.AlertTopicCriticalArn,
      channelField: "channelIdCritical",
    },
    {
      suffix: "warning",
      topicName: `flex-alerts-prod-warning-${region}`,
      ssmKey: STAGE_KEYS.AlertTopicWarningArn,
      channelField: "channelIdWarning",
    },
  ];
}

function readMonitoringConfig(scope: Construct): MonitoringConfig {
  const raw = StringParameter.valueFromLookup(
    scope,
    ENV_KEYS.MonitoringConfig,
    "{}",
  );
  try {
    return JSON.parse(raw) as MonitoringConfig;
  } catch {
    return {};
  }
}

export class FlexMonitoringStack extends BaseStack {
  constructor(
    scope: Construct,
    id: string,
    { region }: FlexMonitoringStackProps,
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: { region },
    });

    const alertsKey = new Key(this, "AlertsKey", {
      alias: `alias/flex-alerts-${stage}-${region}`,
      description: `Encryption key for FLEX alert SNS topics (${stage}, ${region})`,
      enableKeyRotation: true,
    });
    alertsKey.grantEncryptDecrypt(new ServicePrincipal("sns.amazonaws.com"));

    const config = readMonitoringConfig(this);

    const topicBundles = buildTopicSpecs(region).map((spec) => ({
      spec,
      topic: new Topic(this, `Topic-${spec.suffix}`, {
        topicName: spec.topicName,
        displayName: `FLEX alerts ${stage} ${region} (${spec.suffix})`,
        masterKey: alertsKey,
      }),
    }));

    topicBundles.forEach(({ spec, topic }) => {
      const alarm = new Alarm(this, `TestAlarm-${spec.suffix}`, {
        alarmName: `flex-alerts-test-${stage}-${region}-${spec.suffix}`,
        alarmDescription:
          `Synthetic test alarm for ${spec.topicName}. ` +
          "Never fires naturally — trigger via " +
          `\`aws cloudwatch set-alarm-state --region ${region} ` +
          `--alarm-name <this-alarm> --state-value ALARM --state-reason test\` ` +
          "to verify Slack delivery.",
        metric: new Metric({
          namespace: "Flex/AlertingTest",
          metricName: "NeverPublished",
          period: Duration.minutes(1),
          statistic: "Sum",
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(new SnsAction(topic));
    });

    topicBundles.forEach(({ spec, topic }) => {
      this.export(spec.ssmKey, topic.topicArn);
    });

    const slackReady = persistent && Boolean(config.workspaceId);
    const slackBundles = slackReady
      ? topicBundles.filter(({ spec }) => Boolean(config[spec.channelField]))
      : [];

    slackBundles.forEach(({ spec, topic }) => {
      const slack = new SlackChannelConfiguration(
        this,
        `Slack-${spec.suffix}`,
        {
          slackChannelConfigurationName: `flex-alerts-${stage}-${region}-${spec.suffix}`,
          slackWorkspaceId: config.workspaceId as string,
          slackChannelId: config[spec.channelField] as string,
          notificationTopics: [topic],
          guardrailPolicies: [
            ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess"),
          ],
        },
      );

      slack.role?.addToPrincipalPolicy(
        new PolicyStatement({
          actions: ["kms:Decrypt", "kms:GenerateDataKey"],
          resources: [alertsKey.keyArn],
        }),
      );
    });
  }
}
