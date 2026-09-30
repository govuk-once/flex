import { Stack } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Topic } from "aws-cdk-lib/aws-sns";

export function createTestStack() {
  return new Stack(undefined, "TestStack", {
    env: { account: "123456789012", region: "eu-west-2" },
  });
}

export function createAlarmActions(stack: Stack) {
  const criticalTopic = new Topic(stack, "CriticalTestTopic");
  const warningTopic = new Topic(stack, "WarningTestTopic");

  return {
    criticalAction: new SnsAction(criticalTopic),
    warningAction: new SnsAction(warningTopic),
    criticalActionRef: stack.resolve(criticalTopic.topicArn) as unknown,
    warningActionRef: stack.resolve(warningTopic.topicArn) as unknown,
  };
}
