import { Match, Template } from "aws-cdk-lib/assertions";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import { describe, it, vi } from "vitest";

import {
  createAlarmActions,
  createTestStack,
} from "../../__tests__/alarm-actions";
import { createKeyChangeAlerts } from "./key-change-alerts";

vi.hoisted(() => {
  process.env.STAGE = "staging";
});

function synthesise() {
  const stack = createTestStack();
  const actions = createAlarmActions(stack);
  const alarmTopicKey = new Key(stack, "AlarmTopicKey");
  const criticalTopic = new Topic(stack, "CriticalTopic", {
    masterKey: alarmTopicKey,
  });

  createKeyChangeAlerts(stack, {
    criticalTopic,
    alarmTopicKey,
    warningAction: actions.warningAction,
  });

  return {
    template: Template.fromStack(stack),
    topicRef: stack.resolve(criticalTopic.topicArn) as unknown,
  };
}

describe("createKeyChangeAlerts", () => {
  it("alerts on destructive KMS key calls made outside a CloudFormation deployment", () => {
    const { template, topicRef } = synthesise();

    template.hasResourceProperties("AWS::Events::Rule", {
      EventPattern: Match.objectLike({
        source: ["aws.kms"],
        detail: Match.objectLike({
          eventSource: ["kms.amazonaws.com"],
          eventName: [
            "DisableKey",
            "ScheduleKeyDeletion",
            "PutKeyPolicy",
            "DeleteAlias",
            "DisableKeyRotation",
          ],
          userIdentity: Match.objectLike({ $or: Match.anyValue() }),
        }),
      }),
      Targets: [Match.objectLike({ Arn: topicRef })],
    });
  });

  it("alerts on Cognito user pool or client deletion", () => {
    const { template, topicRef } = synthesise();

    template.hasResourceProperties("AWS::Events::Rule", {
      EventPattern: Match.objectLike({
        source: ["aws.cognito-idp"],
        detail: {
          eventSource: ["cognito-idp.amazonaws.com"],
          eventName: ["DeleteUserPool", "DeleteUserPoolClient"],
        },
      }),
      Targets: [Match.objectLike({ Arn: topicRef })],
    });
  });

  it("warns when an alert cannot be delivered", () => {
    synthesise().template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-kms-key-change-alert-undelivered",
    });
  });
});
