import { Script } from "node:vm";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { RELAY_HANDLER_CODE } from "./relay-handler";

interface SnsRecord {
  Sns: {
    Subject?: string;
    Message: string;
    MessageAttributes?: Record<string, { Type: string; Value: string }>;
  };
}

type RelayHandler = (event: { Records?: SnsRecord[] }) => Promise<void>;

const TARGET_TOPIC_ARN =
  "arn:aws:sns:eu-west-2:123456789012:flex-alerts-critical";

const send = vi.fn();
const clientConfig = vi.fn();

class SNSClient {
  constructor(config: unknown) {
    clientConfig(config);
  }

  send(command: { input: unknown }) {
    return send(command.input) as Promise<unknown>;
  }
}

class PublishCommand {
  constructor(public readonly input: unknown) {}
}

function loadHandler(): RelayHandler {
  const module = { exports: {} as { handler?: RelayHandler } };
  const sandboxRequire = (name: string) => {
    if (name !== "@aws-sdk/client-sns") {
      throw new Error(`Unexpected require: ${name}`);
    }
    return { SNSClient, PublishCommand };
  };

  new Script(RELAY_HANDLER_CODE).runInNewContext({
    require: sandboxRequire,
    exports: module.exports,
    module,
    process: { env: { TARGET_TOPIC_ARN } },
    Promise,
  });

  if (!module.exports.handler) {
    throw new Error("Relay code does not export a handler");
  }

  return module.exports.handler;
}

describe("relay handler code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    send.mockResolvedValue({});
  });

  it("is valid JavaScript that exports a handler", () => {
    expect(loadHandler).not.toThrow();
  });

  it("creates the SNS client in eu-west-2", () => {
    loadHandler();

    expect(clientConfig).toHaveBeenCalledWith({ region: "eu-west-2" });
  });

  it("publishes every record to the topic in TARGET_TOPIC_ARN", async () => {
    await loadHandler()({
      Records: [
        { Sns: { Subject: "ALARM: a", Message: '{"AlarmName":"a"}' } },
        { Sns: { Subject: "ALARM: b", Message: '{"AlarmName":"b"}' } },
      ],
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({
      TopicArn: TARGET_TOPIC_ARN,
      Subject: "ALARM: a",
      Message: '{"AlarmName":"a"}',
    });
    expect(send).toHaveBeenCalledWith({
      TopicArn: TARGET_TOPIC_ARN,
      Subject: "ALARM: b",
      Message: '{"AlarmName":"b"}',
    });
  });

  it("trims the subject to the 100 characters SNS accepts", async () => {
    await loadHandler()({
      Records: [{ Sns: { Subject: "x".repeat(150), Message: "m" } }],
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ Subject: "x".repeat(100) }),
    );
  });

  it("publishes without a subject when the record has none", async () => {
    await loadHandler()({ Records: [{ Sns: { Message: "m" } }] });

    expect(send).toHaveBeenCalledWith({
      TopicArn: TARGET_TOPIC_ARN,
      Subject: undefined,
      Message: "m",
    });
  });

  it("does not forward message attributes", async () => {
    await loadHandler()({
      Records: [
        {
          Sns: {
            Message: "m",
            MessageAttributes: { key: { Type: "String", Value: "value" } },
          },
        },
      ],
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.lastCall?.[0]).not.toHaveProperty("MessageAttributes");
  });

  it("does nothing when the event has no records", async () => {
    await loadHandler()({});

    expect(send).not.toHaveBeenCalled();
  });

  it("fails the invocation when a publish fails", async () => {
    send.mockRejectedValueOnce(new Error("KMS.AccessDeniedException"));

    await expect(
      loadHandler()({ Records: [{ Sns: { Message: "m" } }] }),
    ).rejects.toThrow("KMS.AccessDeniedException");
  });
});
