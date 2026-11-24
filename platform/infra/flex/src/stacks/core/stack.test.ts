import { Match, Template } from "aws-cdk-lib/assertions";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { loadInfra } from "../../__tests__/load-infra";

async function synthesise(stage = "staging") {
  const { SsmApp, ENV_KEYS } = await loadInfra(stage);
  const { FlexCoreStack } = await import("./stack");

  const app = new SsmApp();
  app.addExternalExports("eu-west-2", [
    ENV_KEYS.DvlaConfigSecretArn,
    ENV_KEYS.MonitoringSlackWorkspaceId,
    ENV_KEYS.MonitoringSlackChannelId,
    ENV_KEYS.MonitoringCriticalSlackChannelId,
    ENV_KEYS.MonitoringConnectCriticalSlackChannelId,
  ]);

  const stack = new FlexCoreStack(app, `${stage}-FlexCore`);
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

  it("does not post to the GOV.UK Connect channel outside production", () => {
    const { template } = result;

    template.resourceCountIs("AWS::Chatbot::SlackChannelConfiguration", 2);
  });

  it("warns when log ingestion in eu-west-2 is excessive", () => {
    const { template, warningTopicId } = result;

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-log-volume-incoming-bytes",
      Namespace: "AWS/Logs",
      MetricName: "IncomingBytes",
      AlarmActions: [{ Ref: warningTopicId }],
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

describe("FlexCoreStack production alert routing", () => {
  let result: Awaited<ReturnType<typeof synthesise>>;

  beforeAll(async () => {
    result = await synthesise("production");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("also posts critical alarms to the shared GOV.UK Connect channel", () => {
    const { template, criticalTopicId } = result;

    template.hasResourceProperties("AWS::Chatbot::SlackChannelConfiguration", {
      ConfigurationName: "flex-alerts-critical-production-govuk-connect",
      SnsTopicArns: [{ Ref: criticalTopicId }],
    });
  });
});

describe("FlexCoreStack alarm delivery status logging", () => {
  let result: Awaited<ReturnType<typeof synthesise>>;

  beforeAll(async () => {
    result = await synthesise();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  const feedbackRoleId = (topicName: string) => {
    const [topic] = Object.values(
      result.template.findResources("AWS::SNS::Topic", {
        Properties: { TopicName: topicName },
      }),
    ) as {
      Properties: {
        DeliveryStatusLogging: {
          FailureFeedbackRoleArn: { "Fn::GetAtt": [string, string] };
        }[];
      };
    }[];

    return topic?.Properties.DeliveryStatusLogging[0]?.FailureFeedbackRoleArn[
      "Fn::GetAtt"
    ][0];
  };

  it.each([
    { topicName: "flex-alerts-critical" },
    { topicName: "flex-alerts-warning" },
  ])(
    "logs every Slack delivery attempt for $topicName, failed or successful",
    ({ topicName }) => {
      const roleArn = Match.objectLike({ "Fn::GetAtt": Match.anyValue() });

      result.template.hasResourceProperties("AWS::SNS::Topic", {
        TopicName: topicName,
        DeliveryStatusLogging: [
          {
            Protocol: "http/s",
            FailureFeedbackRoleArn: roleArn,
            SuccessFeedbackRoleArn: roleArn,
            SuccessFeedbackSampleRate: "100",
          },
        ],
      });
    },
  );

  it("keeps the delivery logs SNS writes for a year under the names SNS expects", () => {
    const { template, criticalTopicId } = result;
    const logGroupName = (suffix: string) => ({
      "Fn::Join": [
        "",
        [
          "sns/eu-west-2/123456789012/",
          { "Fn::GetAtt": [criticalTopicId, "TopicName"] },
          ...(suffix ? [suffix] : []),
        ],
      ],
    });

    ["", "/Failure"].forEach((suffix) => {
      template.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: logGroupName(suffix),
        RetentionInDays: 365,
      });
    });
  });

  it("gives each topic its own feedback role that only SNS can assume", () => {
    const criticalRoleId = feedbackRoleId("flex-alerts-critical");

    expect(criticalRoleId).toBeDefined();
    expect(criticalRoleId).not.toEqual(feedbackRoleId("flex-alerts-warning"));
    result.template.hasResource("AWS::IAM::Role", {
      Properties: {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: { Service: "sns.amazonaws.com" },
            },
          ],
          Version: "2012-10-17",
        },
      },
    });
  });

  it("limits the feedback role to writing to its own topic's log groups", () => {
    const { template } = result;
    const policies = Object.values(
      template.findResources("AWS::IAM::Policy", {
        Properties: {
          Roles: [{ Ref: feedbackRoleId("flex-alerts-critical") }],
        },
      }),
    ) as {
      Properties: {
        PolicyDocument: {
          Statement: { Action: string[]; Resource: unknown }[];
        };
      };
    }[];
    const statements = policies.flatMap(
      (policy) => policy.Properties.PolicyDocument.Statement,
    );
    const criticalLogGroupIds = Object.keys(
      template.findResources("AWS::Logs::LogGroup"),
    ).filter((id) => id.startsWith("CriticalTopicDelivery"));

    expect(criticalLogGroupIds).toHaveLength(2);
    expect(statements).toHaveLength(2);
    statements.forEach((statement) => {
      expect(statement.Action).toEqual([
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ]);
    });
    expect(statements.map((statement) => statement.Resource)).toEqual(
      criticalLogGroupIds.map((id) => ({ "Fn::GetAtt": [id, "Arn"] })),
    );
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
