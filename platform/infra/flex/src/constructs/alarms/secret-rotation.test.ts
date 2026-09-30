import { Template } from "aws-cdk-lib/assertions";
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { describe, it } from "vitest";

import { createAlarmActions, createTestStack } from "../../test/alarm-actions";
import { SecretRotationAlarms } from "./secret-rotation";

function synthesise() {
  const stack = createTestStack();
  const actions = createAlarmActions(stack);
  const fn = new LambdaFunction(stack, "RotationFunction", {
    runtime: Runtime.NODEJS_24_X,
    handler: "index.handler",
    code: Code.fromInline("exports.handler = async () => {};"),
  });

  new SecretRotationAlarms(stack, "SecretRotationAlarms", {
    alarmNamePrefix: "staging-dvla-secret-rotation",
    fn,
    criticalAction: actions.criticalAction,
    warningAction: actions.warningAction,
  });

  return {
    template: Template.fromStack(stack),
    functionRef: stack.resolve(fn.functionName) as unknown,
    ...actions,
  };
}

describe("SecretRotationAlarms", () => {
  it("alarms critical on any rotation Lambda error within 5 minutes", () => {
    const { template, functionRef, criticalActionRef } = synthesise();

    template.resourceCountIs("AWS::CloudWatch::Alarm", 1);
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-dvla-secret-rotation-failed",
      Namespace: "AWS/Lambda",
      MetricName: "Errors",
      Dimensions: [{ Name: "FunctionName", Value: functionRef }],
      Statistic: "Sum",
      Period: 300,
      Threshold: 0,
      EvaluationPeriods: 1,
      ComparisonOperator: "GreaterThanThreshold",
      TreatMissingData: "notBreaching",
      AlarmActions: [criticalActionRef],
    });
  });
});
