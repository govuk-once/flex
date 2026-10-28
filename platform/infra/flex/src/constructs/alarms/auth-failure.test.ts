import { Match, Template } from "aws-cdk-lib/assertions";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { describe, it } from "vitest";

import {
  createAlarmActions,
  createTestStack,
} from "../../__tests__/alarm-actions";
import { AuthFailureAlarms } from "./auth-failure";

function synthesise() {
  const stack = createTestStack();
  const actions = createAlarmActions(stack);

  new AuthFailureAlarms(stack, "AuthFailureAlarms", {
    alarmNamePrefix: "staging-apigw",
    accessLogGroup: new LogGroup(stack, "AccessLogs"),
    criticalAction: actions.criticalAction,
    warningAction: actions.warningAction,
  });

  return { template: Template.fromStack(stack), ...actions };
}

describe("AuthFailureAlarms", () => {
  it("counts 401 and 403 responses against all requests from the access logs", () => {
    const { template } = synthesise();

    template.hasResourceProperties("AWS::Logs::MetricFilter", {
      FilterPattern: '{ ($.status = "401") || ($.status = "403") }',
      MetricTransformations: [
        Match.objectLike({ MetricName: "staging-apigw-rejected" }),
      ],
    });
    template.hasResourceProperties("AWS::Logs::MetricFilter", {
      FilterPattern: '{ $.status = "*" }',
      MetricTransformations: [
        Match.objectLike({ MetricName: "staging-apigw-requests" }),
      ],
    });
  });

  it("pages when more than half of requests are rejected over both 15m and 5m", () => {
    const { template, criticalActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-apigw-auth-failure-15m",
      Threshold: 50,
      Metrics: Match.arrayWith([
        Match.objectLike({
          Expression: Match.stringLikeRegexp(
            String.raw`FILL\(requests, 0\) >= 20`,
          ),
        }),
        Match.objectLike({ MetricStat: Match.objectLike({ Period: 900 }) }),
      ]),
    });
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-apigw-auth-failure-5m",
      Metrics: Match.arrayWith([
        Match.objectLike({ MetricStat: Match.objectLike({ Period: 300 }) }),
      ]),
    });
    template.hasResourceProperties("AWS::CloudWatch::CompositeAlarm", {
      AlarmName: "staging-apigw-auth-failure",
      AlarmActions: [criticalActionRef],
      AlarmDescription: Match.stringLikeRegexp("^Critical: AUTH FAILURE"),
    });
  });
});
