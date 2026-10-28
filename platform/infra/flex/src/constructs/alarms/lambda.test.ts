import { Duration } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { describe, it, vi } from "vitest";

import {
  createAlarmActions,
  createTestStack,
} from "../../__tests__/alarm-actions";
import { LambdaAlarms } from "./lambda";

vi.hoisted(() => {
  process.env.STAGE = "staging";
});

function synthesise() {
  const stack = createTestStack();
  const actions = createAlarmActions(stack);
  const fn = new LambdaFunction(stack, "RouteFunction", {
    runtime: Runtime.NODEJS_24_X,
    handler: "index.handler",
    code: Code.fromInline("exports.handler = async () => {};"),
    timeout: Duration.seconds(20),
  });

  new LambdaAlarms(stack, "LambdaAlarms", {
    alarmNamePrefix: "staging-route-alarm",
    fn,
    criticalAction: actions.criticalAction,
    warningAction: actions.warningAction,
  });

  return { template: Template.fromStack(stack), ...actions };
}

describe("LambdaAlarms", () => {
  it("warns rather than pages on a single function's error rate and throttles", () => {
    const { template, warningActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-route-alarm-error-rate",
      AlarmActions: [warningActionRef],
    });
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-route-alarm-throttles",
      AlarmActions: [warningActionRef],
    });
  });

  it("ignores duration tails below 10 invocations so cold starts do not alarm", () => {
    const { template, warningActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-route-alarm-duration",
      Threshold: 16000,
      EvaluationPeriods: 3,
      DatapointsToAlarm: 2,
      Metrics: Match.arrayWith([
        Match.objectLike({
          Expression: "IF(invocations >= 10, duration, 0)",
        }),
        Match.objectLike({
          MetricStat: Match.objectLike({
            Metric: Match.objectLike({ MetricName: "Duration" }),
            Stat: "p99",
          }),
        }),
      ]),
      AlarmActions: [warningActionRef],
    });
  });
});
