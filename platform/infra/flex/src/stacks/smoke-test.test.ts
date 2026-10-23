import { Match, Template } from "aws-cdk-lib/assertions";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { loadInfra } from "../__tests__/load-infra";

describe("FlexSmokeTestStack", () => {
  let template: Template;
  let criticalTopicRef: unknown;

  beforeAll(async () => {
    const { SsmApp, ENV_KEYS } = await loadInfra("staging");
    const { FlexSmokeTestStack } = await import("./smoke-test");

    const app = new SsmApp();
    app.addExternalExports("eu-west-2", [
      ENV_KEYS.TopicCriticalAlarms,
      ENV_KEYS.TopicWarningAlarms,
    ]);

    template = Template.fromStack(
      new FlexSmokeTestStack(app, "staging-FlexSmokeTest"),
    );

    const [parameterId] = Object.entries(
      template.toJSON().Parameters as Record<string, { Default?: string }>,
    ).find(
      ([, parameter]) => parameter.Default === ENV_KEYS.TopicCriticalAlarms,
    ) ?? [undefined];
    criticalTopicRef = { Ref: parameterId };
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("publishes metrics only to the Flex/SmokeTest namespace", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Effect: "Allow",
            Action: "cloudwatch:PutMetricData",
            Resource: "*",
            Condition: {
              StringEquals: { "cloudwatch:namespace": "Flex/SmokeTest" },
            },
          },
        ]),
      },
    });
  });

  it("runs every minute", () => {
    template.hasResourceProperties("AWS::Events::Rule", {
      ScheduleExpression: "rate(1 minute)",
    });
  });

  it("pages after three consecutive failed or missing runs of each probed journey", () => {
    expect(criticalTopicRef).toBeDefined();

    ["udp", "travel"].forEach((journey) => {
      template.hasResourceProperties("AWS::CloudWatch::Alarm", {
        AlarmName: `staging-smoke-test-${journey}-no-success`,
        Namespace: "Flex/SmokeTest",
        MetricName: "SmokeTestSuccess",
        Dimensions: Match.arrayWith([
          { Name: "Environment", Value: "staging" },
          { Name: "Journey", Value: journey },
        ]),
        Period: 60,
        Threshold: 1,
        EvaluationPeriods: 3,
        DatapointsToAlarm: 3,
        ComparisonOperator: "LessThanThreshold",
        TreatMissingData: "breaching",
        AlarmActions: [criticalTopicRef],
      });
    });
  });

  it("pages when the probe's valid token is repeatedly rejected", () => {
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-smoke-test-auth-rejected",
      MetricName: "SmokeTestAuthRejected",
      Threshold: 0,
      EvaluationPeriods: 3,
      DatapointsToAlarm: 3,
      ComparisonOperator: "GreaterThanThreshold",
      AlarmActions: [criticalTopicRef],
    });
  });
});
