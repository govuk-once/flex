import { Match, Template } from "aws-cdk-lib/assertions";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { describe, expect, it, vi } from "vitest";

import {
  createAlarmActions,
  createTestStack,
} from "../../__tests__/alarm-actions";
import { JourneyAlarms, JOURNEYS } from "./journeys";

vi.hoisted(() => {
  process.env.STAGE = "staging";
});

function synthesise() {
  const stack = createTestStack();
  const actions = createAlarmActions(stack);
  const accessLogGroup = new LogGroup(stack, "AccessLogs");

  new JourneyAlarms(stack, "JourneyAlarms", {
    alarmNamePrefix: "staging-journey",
    accessLogGroup,
    criticalAction: actions.criticalAction,
    warningAction: actions.warningAction,
  });

  return { template: Template.fromStack(stack), ...actions };
}

describe("JourneyAlarms", () => {
  it("creates a valid and a failed request filter per journey", () => {
    const { template } = synthesise();

    template.resourceCountIs("AWS::Logs::MetricFilter", JOURNEYS.length * 2);
    template.hasResourceProperties("AWS::Logs::MetricFilter", {
      FilterPattern: Match.stringLikeRegexp(
        String.raw`\$\.resourcePath = "/app/udp/v1/\*".*\$\.httpMethod = "GET".*\$\.status = "5\*".*\$\.status = "429"`,
      ),
      MetricTransformations: [
        Match.objectLike({
          MetricNamespace: "Flex/Journeys",
          MetricName: "staging-journey-reads-failed-requests",
          MetricValue: "1",
          DefaultValue: 0,
        }),
      ],
    });
  });

  it("excludes the DVLA test notification route from the driving journey", () => {
    synthesise().template.hasResourceProperties("AWS::Logs::MetricFilter", {
      FilterPattern: Match.stringLikeRegexp(
        String.raw`\$\.resourcePath != "/app/dvla/v1/test-notification"`,
      ),
      MetricTransformations: [
        Match.objectLike({
          MetricName: "staging-journey-driving-valid-requests",
        }),
      ],
    });
  });

  it("pages on reads only when both the 1h and 5m windows burn at 14.4x the 99.5% budget", () => {
    const { template, criticalActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-journey-reads-fast-burn-1h",
      Threshold: 7.2,
      EvaluationPeriods: 1,
      Metrics: Match.arrayWith([
        Match.objectLike({
          Expression: Match.stringLikeRegexp(
            String.raw`IF\(FILL\(valid, 0\) >= 20`,
          ),
        }),
        Match.objectLike({ MetricStat: Match.objectLike({ Period: 3600 }) }),
      ]),
    });
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-journey-reads-fast-burn-5m",
      Threshold: 7.2,
      Metrics: Match.arrayWith([
        Match.objectLike({ MetricStat: Match.objectLike({ Period: 300 }) }),
      ]),
    });
    template.hasResourceProperties("AWS::CloudWatch::CompositeAlarm", {
      AlarmName: "staging-journey-reads-fast-burn",
      AlarmRule: Match.anyValue(),
      AlarmActions: [criticalActionRef],
      AlarmDescription: Match.stringLikeRegexp("^Critical: READS DEGRADED"),
    });
  });

  it("holds writes to the tighter 99.9% budget", () => {
    synthesise().template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-journey-writes-fast-burn-1h",
      Threshold: 1.44,
    });
  });

  it("warns on a 6x slow burn over 6h and 30m", () => {
    const { template, warningActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-journey-reads-slow-burn-6h",
      Threshold: 3,
      Metrics: Match.arrayWith([
        Match.objectLike({ MetricStat: Match.objectLike({ Period: 21600 }) }),
      ]),
    });
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-journey-reads-slow-burn-30m",
      Metrics: Match.arrayWith([
        Match.objectLike({ MetricStat: Match.objectLike({ Period: 1800 }) }),
      ]),
    });
    template.hasResourceProperties("AWS::CloudWatch::CompositeAlarm", {
      AlarmName: "staging-journey-reads-slow-burn",
      AlarmActions: [warningActionRef],
    });
  });

  it("keeps the travel journey as a warning even on a fast burn", () => {
    const { template, warningActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::CompositeAlarm", {
      AlarmName: "staging-journey-travel-fast-burn",
      AlarmActions: [warningActionRef],
    });
  });

  it("gives the window alarms no actions of their own", () => {
    const { template } = synthesise();
    const windowAlarms = Object.values(
      template.findResources("AWS::CloudWatch::Alarm"),
    ) as { Properties: { AlarmActions?: unknown[] } }[];

    expect(windowAlarms).toHaveLength(JOURNEYS.length * 4);
    windowAlarms.forEach((alarm) => {
      expect(alarm.Properties.AlarmActions).toBeUndefined();
    });
  });
});
