import { METRIC_NAMESPACE } from "@platform/credential-monitor/metrics";
import { Match, Template } from "aws-cdk-lib/assertions";
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { describe, expect, it } from "vitest";

import { createAlarmActions, createTestStack } from "../../test/alarm-actions";
import { CredentialMonitorAlarms } from "./credential-monitor";

function synthesise() {
  const stack = createTestStack();
  const actions = createAlarmActions(stack);
  const monitorFunction = new LambdaFunction(stack, "MonitorFunction", {
    runtime: Runtime.NODEJS_24_X,
    handler: "index.handler",
    code: Code.fromInline("exports.handler = async () => {};"),
  });

  new CredentialMonitorAlarms(stack, "CredentialMonitorAlarms", {
    alarmNamePrefix: "staging-credential-monitor",
    environment: "staging",
    monitorFunction,
    criticalAction: actions.criticalAction,
    warningAction: actions.warningAction,
  });

  return {
    template: Template.fromStack(stack),
    functionRef: stack.resolve(monitorFunction.functionName) as unknown,
    ...actions,
  };
}

const environmentDimension = [{ Name: "Environment", Value: "staging" }];

describe("CredentialMonitorAlarms", () => {
  it("creates five alarms", () => {
    synthesise().template.resourceCountIs("AWS::CloudWatch::Alarm", 5);
  });

  it.each([
    ["secret-rotation-overdue", "SecretRotationOverdue"],
    ["secret-rotation-unverifiable", "SecretRotationUnverifiable"],
  ])(
    "warns on any %s credential and keeps its state through a missed run",
    (suffix, metricName) => {
      const { template, warningActionRef } = synthesise();

      template.hasResourceProperties("AWS::CloudWatch::Alarm", {
        AlarmName: `staging-credential-monitor-${suffix}`,
        Namespace: METRIC_NAMESPACE,
        MetricName: metricName,
        Dimensions: environmentDimension,
        Statistic: "Maximum",
        Period: 3600,
        Threshold: 0,
        EvaluationPeriods: 1,
        DatapointsToAlarm: 1,
        ComparisonOperator: "GreaterThanThreshold",
        TreatMissingData: "ignore",
        AlarmActions: [warningActionRef],
      });
    },
  );

  it("raises Cognito drift as critical", () => {
    const { template, criticalActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-credential-monitor-cognito-config-drift",
      Namespace: METRIC_NAMESPACE,
      MetricName: "CognitoConfigDrift",
      Dimensions: environmentDimension,
      Statistic: "Maximum",
      Threshold: 0,
      TreatMissingData: "ignore",
      AlarmActions: [criticalActionRef],
    });
  });

  it("warns when no run succeeds in 3 of the last 4 hours, counting missing hours as zero", () => {
    const { template, warningActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-credential-monitor-not-reporting",
      Threshold: 1,
      EvaluationPeriods: 4,
      DatapointsToAlarm: 3,
      ComparisonOperator: "LessThanThreshold",
      TreatMissingData: "notBreaching",
      AlarmActions: [warningActionRef],
      Metrics: Match.arrayWith([
        Match.objectLike({ Expression: "FILL(value, 0)", ReturnData: true }),
        Match.objectLike({
          Id: "value",
          ReturnData: false,
          MetricStat: Match.objectLike({
            Metric: {
              Namespace: METRIC_NAMESPACE,
              MetricName: "CredentialMonitorSuccess",
              Dimensions: environmentDimension,
            },
            Period: 3600,
            Stat: "Sum",
          }),
        }),
      ]),
    });
  });

  it("warns when the monitor fails in each of the last 3 hours, counting missing hours as zero", () => {
    const { template, functionRef, warningActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-credential-monitor-failing",
      Threshold: 0,
      EvaluationPeriods: 3,
      DatapointsToAlarm: 3,
      ComparisonOperator: "GreaterThanThreshold",
      TreatMissingData: "notBreaching",
      AlarmActions: [warningActionRef],
      Metrics: Match.arrayWith([
        Match.objectLike({ Expression: "FILL(value, 0)", ReturnData: true }),
        Match.objectLike({
          Id: "value",
          MetricStat: Match.objectLike({
            Metric: {
              Namespace: "AWS/Lambda",
              MetricName: "Errors",
              Dimensions: [{ Name: "FunctionName", Value: functionRef }],
            },
            Stat: "Sum",
          }),
        }),
      ]),
    });
  });

  it("sends only Cognito drift to the critical topic", () => {
    const { template, criticalActionRef } = synthesise();
    const critical = template.findResources("AWS::CloudWatch::Alarm", {
      Properties: { AlarmActions: [criticalActionRef] },
    });

    expect(Object.keys(critical)).toHaveLength(1);
  });
});
