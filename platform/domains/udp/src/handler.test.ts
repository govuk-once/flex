import { it } from "@flex/testing";
import { APIGatewayProxyEvent } from "aws-lambda";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./handler";

const MOCK_SECRET_ARN =
  "arn:aws:secretsmanager:eu-west-2:123456789:secret:udp-consumer-config";
const MOCK_CONSUMER_CONFIG = {
  region: "eu-west-2",
  apiAccountId: "123456789",
  apiUrl: "https://abc123.execute-api.eu-west-2.amazonaws.com/gateways/udp",
  apiKey: "1234567890",
  consumerRoleArn: "arn:aws:iam::123456789:role/test-consumer",
};

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: MOCK_SECRET_ARN,
    }),
  ),
}));

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: vi.fn(() => Promise.resolve(JSON.stringify(MOCK_CONSUMER_CONFIG))),
}));

vi.mock("@flex/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@flex/utils")>();
  return {
    ...actual,
    sigv4FetchWithCredentials: vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ test: "test" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  };
});

describe("UDP connector handler", () => {
  const baseEvent: Partial<APIGatewayProxyEvent> = {
    httpMethod: "POST",
    path: "/gateways/udp/v1/user",
    pathParameters: { proxy: "v1/user" },
    headers: {},
    body: null,
    isBase64Encoded: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the remote response body when route is found", async ({
    response,
    context,
  }) => {
    const event = {
      ...baseEvent,
      body: JSON.stringify({ test: "test" }),
    };

    const result = await handler(
      event as unknown as APIGatewayProxyEvent,
      context.create(),
    );

    expect(result).toEqual(
      response.ok(
        { test: "test" },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  });

  it("returns 404 when route is not registered", async ({
    response,
    context,
  }) => {
    const event = {
      ...baseEvent,
      pathParameters: { proxy: "unknown/path" },
      body: JSON.stringify({}),
    };

    const result = await handler(
      event as unknown as APIGatewayProxyEvent,
      context.create(),
    );

    expect(result).toEqual(
      response.notFound(
        { message: "Route not found" },
        { headers: { "Content-Type": "application/json" } },
      ),
    );
  });
});
