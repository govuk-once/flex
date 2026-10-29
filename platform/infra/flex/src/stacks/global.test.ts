import { Match, Template } from "aws-cdk-lib/assertions";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { loadInfra } from "../__tests__/load-infra";

describe("FlexGlobalStack certificate alarm", () => {
  let template: Template;

  beforeAll(async () => {
    const { SsmApp, ENV_KEYS, PLATFORM_KEYS, STAGE_KEYS } =
      await loadInfra("staging");
    const { FlexGlobalStack } = await import("./global");

    const app = new SsmApp();
    app.addExternalExports("eu-west-2", [
      ENV_KEYS.TopicCriticalAlarms,
      ENV_KEYS.TopicWarningAlarms,
      ENV_KEYS.AlarmTopicKeyArn,
      PLATFORM_KEYS.HostedZoneId,
      PLATFORM_KEYS.HostedZoneName,
      STAGE_KEYS.ApigwPublicRestId,
      STAGE_KEYS.ApigwPublicAppRoot,
      STAGE_KEYS.WafCfSecretHeaderArn,
    ]);

    template = Template.fromStack(
      new FlexGlobalStack(app, "staging-FlexGlobal"),
    );
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("creates no Slack channel configuration of its own, since Amazon Q allows one per channel per account", () => {
    template.resourceCountIs("AWS::Chatbot::SlackChannelConfiguration", 0);
    template.hasResourceProperties("AWS::SNS::Topic", {
      TopicName: "staging-flex-alerts-relay-health",
    });
  });

  it("pages when traffic at the edge falls below its learned baseline", () => {
    const criticalRelayId = Object.keys(
      template.findResources("AWS::SNS::Topic"),
    ).find((id) => id.startsWith("CriticalRelayTopic"));

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-cloudfront-traffic-cliff",
      ComparisonOperator: "LessThanLowerThreshold",
      EvaluationPeriods: 3,
      DatapointsToAlarm: 3,
      TreatMissingData: "breaching",
      ThresholdMetricId: Match.anyValue(),
      Metrics: Match.arrayWith([
        Match.objectLike({
          MetricStat: Match.objectLike({
            Metric: Match.objectLike({ MetricName: "Requests" }),
          }),
        }),
      ]),
      AlarmActions: [{ Ref: criticalRelayId }],
    });
  });

  it("alarms on the CloudFront certificate through the critical relay", () => {
    const certificateId = Object.keys(
      template.findResources("AWS::CertificateManager::Certificate"),
    )[0];
    const criticalRelayId = Object.keys(
      template.findResources("AWS::SNS::Topic"),
    ).find((id) => id.startsWith("CriticalRelayTopic"));

    expect(certificateId).toBeDefined();
    expect(criticalRelayId).toBeDefined();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-certificate-days-to-expiry",
      MetricName: "DaysToExpiry",
      Dimensions: [{ Name: "CertificateArn", Value: { Ref: certificateId } }],
      Threshold: 30,
      AlarmActions: [{ Ref: criticalRelayId }],
    });
  });
});
