import { getConfig } from "@flex/params";
import { context, it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { createUdpRemoteClient } from "../client";
import { DomainNotificationsResponse } from "../schemas/domain/notifications";
import type { NotificationsResponse } from "../schemas/remote/notifications";
import { CreateUserResponse } from "../schemas/remote/user";
import type { ConsumerConfig } from "../utils/getConsumerConfig";
import { getConsumerConfig } from "../utils/getConsumerConfig";
import { handler } from "./service-gateway";

vi.mock("../utils/getConsumerConfig", () => ({
  getConsumerConfig: vi.fn(),
}));

vi.mock("../client", () => ({
  createUdpRemoteClient: vi.fn(),
}));

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(),
}));

const TEST_SECRET_ARN =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:udp-consumer";

const TEST_CONSUMER_CONFIG: ConsumerConfig = {
  region: "eu-west-2",
  apiAccountId: "123456789012",
  apiUrl: "https://remote.example.test",
  apiKey: "test-api-key", // pragma: allowlist secret
  consumerRoleArn: "arn:aws:iam::123456789012:role/test-role",
  externalId: "test-external-id",
};

const MOCK_EXPECTED_DOMAIN_NOTIFICATIONS: DomainNotificationsResponse = {
  consentStatus: "accepted",
};

const MOCK_EXPECTED_DOMAIN_USER: CreateUserResponse = {
  message: "User created",
};

const MOCK_REMOTE_NOTIFICATIONS: NotificationsResponse = {
  data: {
    consentStatus: "accepted",
  },
};

const remoteClient = {
  user: {
    create: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "User created" },
    }),
  },
  notifications: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_REMOTE_NOTIFICATIONS,
    }),
    update: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_REMOTE_NOTIFICATIONS,
    }),
  },
};

describe("UDP Service Gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockResolvedValue({
      AWS_REGION: "eu-west-2",
      FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: TEST_SECRET_ARN,
    });
    vi.mocked(getConsumerConfig).mockResolvedValue(TEST_CONSUMER_CONFIG);
    vi.mocked(createUdpRemoteClient).mockReturnValue(remoteClient);
  });

  it.for([
    {
      method: "GET",
      path: "/v1/notifications",
      operation: "getNotificationPreferences",
      headers: { "requesting-service-user-id": "123" },
      expected: MOCK_EXPECTED_DOMAIN_NOTIFICATIONS,
    },
    {
      method: "POST",
      path: "/v1/notifications",
      operation: "updateNotificationPreferences",
      headers: { "requesting-service-user-id": "123" },
      body: { consentStatus: "accepted" },
      expected: MOCK_EXPECTED_DOMAIN_NOTIFICATIONS,
    },
    {
      method: "POST",
      path: "/v1/user",
      operation: "createUser",
      body: { notificationId: "123", appId: "456" },
      expected: MOCK_EXPECTED_DOMAIN_USER,
    },
  ])(
    "routes $method $path to $operation operation and maps remote response to $expected",
    async (
      { method, path, headers, body, expected },
      { privateGatewayEvent },
    ) => {
      const response = await handler(
        privateGatewayEvent.create({
          httpMethod: method,
          path,
          headers,
          body: JSON.stringify(body),
        }),
        context,
      );

      expect(response).toEqual({
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expected),
      });
    },
  );

  it("returns 400 if the remote contract has changed unexpectedly", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.notifications.get.mockResolvedValue({
      ok: false,
      error: {
        status: 400,
        message: "Bad Request",
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/udp/v1/notifications", {
        headers: { "requesting-service-user-id": "pairwise-123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Bad Request",
      }),
    });
  });

  it("maps remote 5xx errors to 502 with sanitized message", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.notifications.get.mockResolvedValue({
      ok: false,
      error: {
        status: 503,
        message: "Service Unavailable",
        body: { detail: "upstream internal details" },
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/udp/v1/notifications", {
        headers: { "requesting-service-user-id": "pairwise-123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 502,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "UDP upstream service unavailable",
      }),
    });
  });

  it("passes through remote 4xx status and body", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.notifications.get.mockResolvedValue({
      ok: false,
      error: {
        status: 404,
        message: "User not found",
        body: { code: "USER_NOT_FOUND" },
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/udp/v1/notifications", {
        headers: { "requesting-service-user-id": "pairwise-123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 404,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "User not found",
        error: { code: "USER_NOT_FOUND" },
      }),
    });
  });

  it("returns 404 for unsupported routes", async ({
    privateGatewayEvent,
    env,
  }) => {
    env.set({
      FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: TEST_SECRET_ARN,
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/udp/v1/unsupported"),
      context,
    );

    expect(response).toEqual({
      statusCode: 404,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Route not found" }),
    });
  });

  it("returns 500 for uncaught exceptions", async ({ privateGatewayEvent }) => {
    vi.mocked(createUdpRemoteClient).mockRejectedValue(new Error("Test error"));
    const response = await handler(
      privateGatewayEvent.get("/gateways/udp/v1/notifications", {
        headers: { "requesting-service-user-id": "pairwise-123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Internal server error" }),
    });
  });
});
