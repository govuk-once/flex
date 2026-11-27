import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
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
    warningAction: actions.warningAction,
  });

  const template = Template.fromStack(stack);
  const [ruleId] = Object.keys(template.findResources("AWS::Events::Rule"));
  const [queueId] = Object.keys(template.findResources("AWS::SQS::Queue"));

  return {
    stack,
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
    const template = Template.fromStack(synthesise().stack);

    template.hasResourceProperties("AWS::Events::Rule", {
      EventPattern: {
        source: ["aws.secretsmanager"],
        "detail-type": ["AWS Service Event via CloudTrail"],
        detail: { eventName: ["RotationFailed", "TestRotationFailed"] },
      },
    });
  });

  it("publishes to the critical topic with a dead-letter queue", () => {
    const { stack, topicRef, queueArn } = synthesise();
    const template = Template.fromStack(stack);

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
    const template = Template.fromStack(synthesise().stack);
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

  it("targets the topic itself, so CDK can resolve the rule and target environments", () => {
    expect(
      Annotations.fromStack(synthesise().stack).findWarning(
        "*",
        Match.stringLikeRegexp("unresolved environment"),
      ),
    ).toEqual([]);
  });

  it("publishes through a role that only EventBridge can assume", () => {
    const template = Template.fromStack(synthesise().stack);
    const [roleId] = Object.keys(
      template.findResources("AWS::IAM::Role", {
        Properties: {
          AssumeRolePolicyDocument: {
            Statement: [
              Match.objectLike({
                Principal: { Service: "events.amazonaws.com" },
              }),
            ],
          },
        },
      }),
    );

    expect(roleId).toBeDefined();
    template.hasResourceProperties("AWS::Events::Rule", {
      Targets: [
        Match.objectLike({ RoleArn: { "Fn::GetAtt": [roleId, "Arn"] } }),
      ],
    });
  });

  it("lets the role publish to the topic and use its key", () => {
    const { stack, topicRef, keyArn } = synthesise();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: "sns:Publish", Resource: topicRef }),
          Match.objectLike({
            Action: ["kms:Decrypt", "kms:GenerateDataKey*"],
            Resource: keyArn,
          }),
        ]),
      },
    });
  });

  it("has no unconditioned EventBridge statement on the topic", () => {
    const policies = Object.values(
      Template.fromStack(synthesise().stack).findResources(
        "AWS::SNS::TopicPolicy",
      ),
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

  it("lets EventBridge use the dead-letter queue key but not the topic key", () => {
    const { stack, keyArn } = synthesise();
    const template = Template.fromStack(stack);
    const [queue] = Object.values(
      template.findResources("AWS::SQS::Queue"),
    ) as { Properties: { KmsMasterKeyId: { "Fn::GetAtt": string[] } } }[];
    const keys = template.findResources("AWS::KMS::Key") as Record<
      string,
      { Properties: { KeyPolicy: { Statement: { Principal?: unknown }[] } } }
    >;
    const grantsEvents = (id = "") =>
      keys[id]?.Properties.KeyPolicy.Statement.some(
        ({ Principal }) =>
          JSON.stringify(Principal) ===
          JSON.stringify({ Service: "events.amazonaws.com" }),
      );
    const topicKeyId = (keyArn as { "Fn::GetAtt": string[] })["Fn::GetAtt"][0];

    expect(
      grantsEvents(queue?.Properties.KmsMasterKeyId["Fn::GetAtt"][0]),
    ).toBe(true);
    expect(grantsEvents(topicKeyId)).toBe(false);
  });

  it("keeps undelivered alerts for 14 days, encrypted with a key other than the alarm topic key", () => {
    const { stack, keyArn } = synthesise();
    const template = Template.fromStack(stack);
    const [queue] = Object.values(
      template.findResources("AWS::SQS::Queue"),
    ) as { Properties: { KmsMasterKeyId: unknown } }[];

    template.hasResourceProperties("AWS::SQS::Queue", {
      MessageRetentionPeriod: 1209600,
    });
    expect(queue?.Properties.KmsMasterKeyId).toBeDefined();
    expect(queue?.Properties.KmsMasterKeyId).not.toEqual(keyArn);
  });

  it("allows only this rule to send to the dead-letter queue, over TLS", () => {
    const { stack, queueArn, ruleArn } = synthesise();
    const template = Template.fromStack(stack);

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
    const { stack, queueName, warningActionRef } = synthesise();
    const template = Template.fromStack(stack);

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
