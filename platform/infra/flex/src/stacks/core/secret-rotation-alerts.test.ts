import { Match, Template } from "aws-cdk-lib/assertions";
import { Key } from "aws-cdk-lib/aws-kms";
import { Topic } from "aws-cdk-lib/aws-sns";
import { describe, expect, it, vi } from "vitest";

import {
  createAlarmActions,
  createTestStack,
} from "../../__tests__/alarm-actions";
import { createSecretRotationFailureAlert } from "./secret-rotation-alerts";

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

  createSecretRotationFailureAlert(stack, {
    criticalTopic,
    alarmTopicKey,
    warningAction: actions.warningAction,
  });

  const template = Template.fromStack(stack);
  const [ruleId] = Object.keys(template.findResources("AWS::Events::Rule"));
  const [queueId] = Object.keys(template.findResources("AWS::SQS::Queue"));

  return {
    template,
    ruleArn: { "Fn::GetAtt": [ruleId, "Arn"] },
    queueArn: { "Fn::GetAtt": [queueId, "Arn"] },
    queueName: { "Fn::GetAtt": [queueId, "QueueName"] },
    topicRef: stack.resolve(criticalTopic.topicArn) as unknown,
    keyArn: stack.resolve(alarmTopicKey.keyArn) as unknown,
    ...actions,
  };
}

describe("createSecretRotationFailureAlert", () => {
  it("matches Secrets Manager rotation failures delivered through CloudTrail", () => {
    synthesise().template.hasResourceProperties("AWS::Events::Rule", {
      EventPattern: {
        source: ["aws.secretsmanager"],
        "detail-type": ["AWS Service Event via CloudTrail"],
        detail: { eventName: ["RotationFailed", "TestRotationFailed"] },
      },
    });
  });

  it("publishes to the critical topic with a dead-letter queue", () => {
    const { template, topicRef, queueArn } = synthesise();

    template.hasResourceProperties("AWS::Events::Rule", {
      Targets: [
        Match.objectLike({
          Arn: topicRef,
          DeadLetterConfig: { Arn: queueArn },
        }),
      ],
    });
  });

  it("sends a Chatbot custom notification naming the event and the secret", () => {
    const { template } = synthesise();
    const [rule] = Object.values(
      template.findResources("AWS::Events::Rule"),
    ) as {
      Properties: {
        Targets: {
          InputTransformer: {
            InputPathsMap: Record<string, string>;
            InputTemplate: string;
          };
        }[];
      };
    }[];
    const transformer = rule?.Properties.Targets[0]?.InputTransformer;

    expect(Object.values(transformer?.InputPathsMap ?? {})).toEqual(
      expect.arrayContaining([
        "$.detail.additionalEventData.SecretId",
        "$.detail.eventName",
      ]),
    );

    const message = JSON.parse(
      (transformer?.InputTemplate ?? "{}").replace(/<[^>]+>/g, "placeholder"),
    ) as {
      version: string;
      source: string;
      content: { textType: string; title: string; description: string };
    };

    expect(message).toMatchObject({
      version: "1.0",
      source: "custom",
      content: {
        textType: "client-markdown",
        title: "Secret rotation failed in staging",
      },
    });
    expect(message.content.description).toContain("can repeat");
  });

  it("allows EventBridge to publish to the topic only from this rule", () => {
    const { template, topicRef, ruleArn } = synthesise();

    template.hasResourceProperties("AWS::SNS::TopicPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Allow",
            Principal: { Service: "events.amazonaws.com" },
            Action: "sns:Publish",
            Resource: topicRef,
            Condition: { ArnEquals: { "aws:SourceArn": ruleArn } },
          }),
        ]),
      },
    });
  });

  it("has no unconditioned EventBridge statement on the topic", () => {
    const policies = Object.values(
      synthesise().template.findResources("AWS::SNS::TopicPolicy"),
    ) as {
      Properties: {
        PolicyDocument: {
          Statement: {
            Principal?: { Service?: unknown };
            Condition?: unknown;
          }[];
        };
      };
    }[];

    const unconditioned = policies
      .flatMap(({ Properties }) => Properties.PolicyDocument.Statement)
      .filter(({ Principal }) => Principal?.Service === "events.amazonaws.com")
      .filter(({ Condition }) => Condition === undefined);

    expect(unconditioned).toEqual([]);
  });

  it("lets EventBridge use the topic's encryption key", () => {
    synthesise().template.hasResourceProperties("AWS::KMS::Key", {
      KeyPolicy: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Allow",
            Principal: { Service: "events.amazonaws.com" },
            Action: ["kms:Decrypt", "kms:GenerateDataKey*"],
          }),
        ]),
      },
    });
  });

  it("keeps undelivered alerts for 14 days, encrypted with the alarm topic key", () => {
    const { template, keyArn } = synthesise();

    template.hasResourceProperties("AWS::SQS::Queue", {
      KmsMasterKeyId: keyArn,
      MessageRetentionPeriod: 1209600,
    });
  });

  it("allows only this rule to send to the dead-letter queue, over TLS", () => {
    const { template, queueArn, ruleArn } = synthesise();

    template.hasResourceProperties("AWS::SQS::QueuePolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Deny",
            Condition: { Bool: { "aws:SecureTransport": "false" } },
            Resource: queueArn,
          }),
          Match.objectLike({
            Effect: "Allow",
            Principal: { Service: "events.amazonaws.com" },
            Action: "sqs:SendMessage",
            Condition: { ArnEquals: { "aws:SourceArn": ruleArn } },
          }),
        ]),
      },
    });
  });

  it("warns when an alert reaches the dead-letter queue", () => {
    const { template, queueName, warningActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-secret-rotation-alert-undelivered",
      Namespace: "AWS/SQS",
      MetricName: "ApproximateNumberOfMessagesVisible",
      Dimensions: [{ Name: "QueueName", Value: queueName }],
      Threshold: 0,
      ComparisonOperator: "GreaterThanThreshold",
      TreatMissingData: "notBreaching",
      AlarmActions: [warningActionRef],
    });
  });
});
