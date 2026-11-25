import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";

import {
  createAlarmActions,
  createTestStack,
} from "../../__tests__/alarm-actions";
import { LogVolumeAlarms } from "./log-volume";

function synthesise() {
  const stack = createTestStack();
  const actions = createAlarmActions(stack);

  new LogVolumeAlarms(stack, "LogVolumeAlarms", {
    alarmNamePrefix: "staging-log-volume",
    criticalAction: actions.criticalAction,
    warningAction: actions.warningAction,
  });

  return { stack, ...actions };
}

describe("LogVolumeAlarms", () => {
  it("creates a single alarm", () => {
    const template = Template.fromStack(synthesise().stack);

    template.resourceCountIs("AWS::CloudWatch::Alarm", 1);
  });

  it("warns when log ingestion stays above 1 GiB per 5 minutes for 15 minutes", () => {
    const { stack, warningActionRef } = synthesise();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-log-volume-incoming-bytes",
      Namespace: "AWS/Logs",
      MetricName: "IncomingBytes",
      Statistic: "Sum",
      Period: 300,
      Threshold: 1073741824,
      EvaluationPeriods: 3,
      DatapointsToAlarm: 3,
      ComparisonOperator: "GreaterThanThreshold",
      TreatMissingData: "notBreaching",
      AlarmActions: [warningActionRef],
    });
  });

  it("measures every log group in the region rather than a single one", () => {
    const [alarm] = Object.values(
      Template.fromStack(synthesise().stack).findResources(
        "AWS::CloudWatch::Alarm",
      ),
    ) as { Properties: { Dimensions?: unknown } }[];

    expect(alarm?.Properties.Dimensions).toBeUndefined();
  });

  it("names the threshold and the region in its description", () => {
    const [alarm] = Object.values(
      Template.fromStack(synthesise().stack).findResources(
        "AWS::CloudWatch::Alarm",
      ),
    ) as { Properties: { AlarmDescription: string } }[];

    expect(alarm?.Properties.AlarmDescription).toContain(
      "CloudWatch Logs in eu-west-2 ingested more than 1 GiB per 5 minute window",
    );
  });
});
