import { Stack } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";

export function createTestStack() {
  return new Stack(undefined, "TestStack", {
    env: { account: "123456789012", region: "eu-west-2" },
  });
}

export function createAlarmActions(stack: Stack) {
  const masterKey = new Key(stack, "AlarmTestTopicKey", {
    enableKeyRotation: true,
  });
  const criticalTopic = new Topic(stack, "CriticalTestTopic", { masterKey });
  const warningTopic = new Topic(stack, "WarningTestTopic", { masterKey });

  return {
    criticalAction: new SnsAction(criticalTopic),
    warningAction: new SnsAction(warningTopic),
    criticalActionRef: stack.resolve(criticalTopic.topicArn) as unknown,
    warningActionRef: stack.resolve(warningTopic.topicArn) as unknown,
  };
}
