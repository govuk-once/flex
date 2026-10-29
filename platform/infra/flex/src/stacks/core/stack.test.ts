import { Match, Template } from "aws-cdk-lib/assertions";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { loadInfra } from "../../__tests__/load-infra";

async function synthesise() {
  const { SsmApp, ENV_KEYS } = await loadInfra("staging");
  const { FlexCoreStack } = await import("./stack");

  const app = new SsmApp();
  app.addExternalExports("eu-west-2", [
    ENV_KEYS.DvlaConfigSecretArn,
    ENV_KEYS.MonitoringSlackWorkspaceId,
    ENV_KEYS.MonitoringSlackChannelId,
    ENV_KEYS.MonitoringCriticalSlackChannelId,
  ]);

  const stack = new FlexCoreStack(app, "staging-FlexCore");
  const template = Template.fromStack(stack);

  const resourceId = (type: string, properties: Record<string, unknown>) =>
    Object.keys(template.findResources(type, { Properties: properties }))[0];

  return {
    template,
    criticalTopicId: resourceId("AWS::SNS::Topic", {
      TopicName: "flex-alerts-critical",
    }),
    warningTopicId: resourceId("AWS::SNS::Topic", {
      TopicName: "flex-alerts-warning",
    }),
    alarmTopicKeyId: resourceId("AWS::KMS::Key", {
      Description: "KMS key for alarm SNS topics",
    }),
  };
}

describe("FlexCoreStack alert routing", () => {
  let result: Awaited<ReturnType<typeof synthesise>>;

  beforeAll(async () => {
    result = await synthesise();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("sends critical alarms and relay health alarms to the critical Slack channel", () => {
    const { template, criticalTopicId } = result;

    template.hasResourceProperties("AWS::Chatbot::SlackChannelConfiguration", {
      ConfigurationName: "flex-alerts-critical-staging",
      SnsTopicArns: [
        { Ref: criticalTopicId },
        {
          "Fn::Join": Match.arrayWith([
            Match.arrayWith([
              Match.stringLikeRegexp(
                ":sns:us-east-1:.*:staging-flex-alerts-relay-health$",
              ),
            ]),
          ]),
        },
      ],
    });
  });

  it("lets the critical channel decrypt the relay health topic key by alias", () => {
    const { template } = result;

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ["kms:Decrypt", "kms:GenerateDataKey"],
            Condition: {
              "ForAnyValue:StringEquals": {
                "kms:ResourceAliases":
                  "alias/staging-flex-alerts-relay-health-key",
              },
            },
          }),
        ]),
      }),
    });
  });

  it("keeps warnings on the original channel without the critical topic", () => {
    const { template, warningTopicId } = result;

    template.hasResourceProperties("AWS::Chatbot::SlackChannelConfiguration", {
      ConfigurationName: "flex-alerts-staging",
      SnsTopicArns: [{ Ref: warningTopicId }],
    });
  });

  it("alerts on KMS key and Cognito user pool changes through the critical topic", () => {
    const { template, criticalTopicId } = result;

    ["aws.kms", "aws.cognito-idp"].forEach((source) => {
      template.hasResourceProperties("AWS::Events::Rule", {
        EventPattern: Match.objectLike({ source: [source] }),
        Targets: [Match.objectLike({ Arn: { Ref: criticalTopicId } })],
      });
    });
  });
});

describe("FlexCoreStack credential alerting", () => {
  let result: Awaited<ReturnType<typeof synthesise>>;

  beforeAll(async () => {
    result = await synthesise();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("sends Secrets Manager rotation failures to the critical alarm topic", () => {
    const { template, criticalTopicId } = result;

    template.hasResourceProperties("AWS::Events::Rule", {
      EventPattern: Match.objectLike({
        source: ["aws.secretsmanager"],
        detail: { eventName: ["RotationFailed", "TestRotationFailed"] },
      }),
      Targets: [Match.objectLike({ Arn: { Ref: criticalTopicId } })],
    });
  });

  it("encrypts the rotation alert dead-letter queue with a key other than the alarm topic key", () => {
    const { template, alarmTopicKeyId } = result;
    const [queue] = Object.values(
      template.findResources("AWS::SQS::Queue"),
    ) as { Properties: { KmsMasterKeyId: unknown } }[];

    expect(queue?.Properties.KmsMasterKeyId).toBeDefined();
    expect(queue?.Properties.KmsMasterKeyId).not.toEqual({
      "Fn::GetAtt": [alarmTopicKeyId, "Arn"],
    });
  });

  it("alarms critical when the DVLA rotation Lambda fails", () => {
    const { template, criticalTopicId } = result;

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-dvla-secret-rotation-failed",
      MetricName: "Errors",
      Threshold: 0,
      AlarmActions: [{ Ref: criticalTopicId }],
    });
  });

  it("warns when a rotation alert cannot be delivered", () => {
    result.template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-secret-rotation-alert-undelivered",
      MetricName: "ApproximateNumberOfMessagesVisible",
    });
  });

  it("exports the alarm topic key ARN for the us-east-1 relay", () => {
    const { template, alarmTopicKeyId } = result;

    template.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/staging/flex/kms/alarm-topic-key-arn",
      Value: { "Fn::GetAtt": [alarmTopicKeyId, "Arn"] },
    });
  });

  it("finds the alarm topic and its key", () => {
    expect(result.criticalTopicId).toBeDefined();
    expect(result.alarmTopicKeyId).toBeDefined();
  });
});
