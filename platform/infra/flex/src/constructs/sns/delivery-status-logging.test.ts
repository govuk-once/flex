import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { LoggingProtocol, Topic } from "aws-cdk-lib/aws-sns";
import { afterEach, describe, expect, it, vi } from "vitest";

async function synthesise(stage: string, protocol: LoggingProtocol) {
  vi.resetModules();
  vi.stubEnv("STAGE", stage);
  const { enableDeliveryStatusLogging } =
    await import("./delivery-status-logging");

  const stack = new Stack(undefined, "TestStack", {
    env: { account: "123456789012", region: "us-east-1" },
  });
  enableDeliveryStatusLogging(new Topic(stack, "RelayTopic"), protocol);

  return stack;
}

const logGroups = (template: Template) =>
  Object.values(template.findResources("AWS::Logs::LogGroup")) as {
    DeletionPolicy: string;
    Properties: { LogGroupName: unknown };
  }[];

describe("enableDeliveryStatusLogging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("logs deliveries for the protocol the topic's subscribers use", async () => {
    const template = Template.fromStack(
      await synthesise("staging", LoggingProtocol.LAMBDA),
    );

    template.hasResourceProperties("AWS::SNS::Topic", {
      DeliveryStatusLogging: [
        {
          Protocol: "lambda",
          SuccessFeedbackSampleRate: "100",
        },
      ],
    });
  });

  it("names the log groups after a topic whose name CloudFormation generates", async () => {
    const template = Template.fromStack(
      await synthesise("staging", LoggingProtocol.LAMBDA),
    );
    const [topicId] = Object.keys(template.findResources("AWS::SNS::Topic"));
    const logGroupNames = logGroups(template).map(
      (logGroup) => logGroup.Properties.LogGroupName,
    );
    const generatedName = { "Fn::GetAtt": [topicId, "TopicName"] };

    expect(logGroupNames).toEqual(
      expect.arrayContaining([
        { "Fn::Join": ["", ["sns/us-east-1/123456789012/", generatedName]] },
        {
          "Fn::Join": [
            "",
            ["sns/us-east-1/123456789012/", generatedName, "/Failure"],
          ],
        },
      ]),
    );
  });

  it("keeps the delivery logs when a persistent environment's stack is deleted", async () => {
    const template = Template.fromStack(
      await synthesise("production", LoggingProtocol.HTTP),
    );

    expect(
      logGroups(template).map((logGroup) => logGroup.DeletionPolicy),
    ).toEqual(["Retain", "Retain"]);
  });

  it("removes the delivery logs with an ephemeral stage so its name can be reused", async () => {
    const template = Template.fromStack(
      await synthesise("pr-123", LoggingProtocol.HTTP),
    );

    expect(
      logGroups(template).map((logGroup) => logGroup.DeletionPolicy),
    ).toEqual(["Delete", "Delete"]);
  });
});
