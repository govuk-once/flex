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

const MOCK_CONSENT_RESPONSE = {
  consentStatus: "consented",
  updatedAt: "2025-01-01T00:00:00Z",
};

vi.mock("@flex/flex-fetch", () => ({
  createSigv4FetchWithCredentials: () =>
    () =>
      Promise.resolve(
        new Response(JSON.stringify(MOCK_CONSENT_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
}));

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
        MOCK_CONSENT_RESPONSE,
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

  it("returns 400 when requesting-service-user-id is missing for routes that require it", async ({
    response,
    context,
  }) => {
    const event = {
      ...baseEvent,
      httpMethod: "GET",
      pathParameters: { proxy: "v1/notifications" },
      headers: {},
      body: null,
    };

    const result = await handler(
      event as unknown as APIGatewayProxyEvent,
      context.create(),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}")).toMatchObject({
      message: "requesting-service-user-id header is required for this route",
    });
  });

  it("accepts requesting-service-user-id with different header casing", async ({
    context,
  }) => {
    const event = {
      ...baseEvent,
      httpMethod: "GET",
      pathParameters: { proxy: "v1/notifications" },
      headers: { "Requesting-Service-User-Id": "pairwise-123" },
      body: null,
    };

    const result = await handler(
      event as unknown as APIGatewayProxyEvent,
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body ?? "{}")).toMatchObject(MOCK_CONSENT_RESPONSE);
  });
});
