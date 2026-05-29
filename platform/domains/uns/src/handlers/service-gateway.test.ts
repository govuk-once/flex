import { context, it } from "@flex/testing";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { createUnsRemoteClient } from "../client";
import type { ConsumerConfig } from "../utils/getConsumerConfig";
import { getConsumerConfig } from "../utils/getConsumerConfig";
import { handler } from "./service-gateway";

vi.mock("../utils/getConsumerConfig", () => ({
  getConsumerConfig: vi.fn(),
}));

vi.mock("../client", () => ({
  createUnsRemoteClient: vi.fn(),
}));

const TEST_SECRET_ARN =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:uns-consumer";

const TEST_CONSUMER_CONFIG: ConsumerConfig = {
  apiUrl: "https://uns-remote.example.test",
  region: "eu-west-2",
  consumerRoleArn: "arn:aws:iam::123456789012:role/uns-consumer",
};

const MOCK_NOTIFICATION_RESPONSE = {
  id: "notif-123",
  status: "READ",
  content: "Hello World",
};

const MOCK_NOTIFICATIONS_LIST = [{ id: "notif-123", status: "READ" }];

const remoteClient = {
  notification: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_NOTIFICATION_RESPONSE,
    }),
    delete: vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      data: undefined,
    }),
    patch: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_NOTIFICATION_RESPONSE,
    }),
  },
  notifications: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_NOTIFICATIONS_LIST,
    }),
  },
};

describe("UNS Service Gateway", () => {
  beforeEach(() => {
    vi.stubEnv("AWS_REGION", "eu-west-2");
    vi.stubEnv("FLEX_UNS_CONSUMER_CONFIG_SECRET_ARN", TEST_SECRET_ARN);

    vi.clearAllMocks();
    vi.mocked(getConsumerConfig).mockResolvedValue(TEST_CONSUMER_CONFIG);
    vi.mocked(createUnsRemoteClient).mockReturnValue(remoteClient);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dispatches GET /v1/notifications/:id and returns notification info", async ({
    privateGatewayEvent,
  }) => {
    const pushId = "user-123";
    const notificationId = "notif-123";

    const response = await handler(
      privateGatewayEvent.get(
        `/gateways/uns/v1/notifications/${notificationId}`,
        {
          queryStringParameters: { externalUserID: pushId },
        },
      ),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_NOTIFICATION_RESPONSE),
    });

    expect(remoteClient.notification.get).toHaveBeenCalledWith(
      pushId,
      notificationId,
    );
  });

  it("dispatches DELETE /v1/notifications/:id", async ({
    privateGatewayEvent,
  }) => {
    const pushId = "user-123";
    const notificationId = "notif-123";

    const response = await handler(
      privateGatewayEvent.delete(
        `/gateways/uns/v1/notifications/${notificationId}`,
        {
          queryStringParameters: { externalUserID: pushId },
          body: {},
        },
      ),
      context,
    );

    expect(response).toEqual({
      statusCode: 204,
      headers: { "Content-Type": "application/json" },
      body: undefined,
    });

    expect(remoteClient.notification.delete).toHaveBeenCalledWith(
      pushId,
      notificationId,
    );
  });

  it("dispatches PATCH /v1/notifications/:id/status", async ({
    privateGatewayEvent,
  }) => {
    const pushId = "user-123";
    const notificationId = "notif-123";
    const patchBody = { Status: "READ" };

    const response = await handler(
      privateGatewayEvent.patch(
        `/gateways/uns/v1/notifications/${notificationId}/status`,
        {
          queryStringParameters: { externalUserID: pushId },
          body: patchBody,
        },
      ),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_NOTIFICATION_RESPONSE),
    });

    expect(remoteClient.notification.patch).toHaveBeenCalledWith(
      pushId,
      notificationId,
      patchBody,
    );
  });

  it("dispatches GET /v1/notifications and returns list", async ({
    privateGatewayEvent,
  }) => {
    const pushId = "user-123";

    const response = await handler(
      privateGatewayEvent.get("/gateways/uns/v1/notifications", {
        queryStringParameters: { externalUserID: pushId },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_NOTIFICATIONS_LIST),
    });

    expect(remoteClient.notifications.get).toHaveBeenCalledWith(pushId);
  });

  it("maps remote 5xx errors to 502 with sanitized message", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.notifications.get.mockResolvedValue({
      ok: false,
      error: {
        status: 503,
        message: "Service Unavailable",
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/uns/v1/notifications", {
        queryStringParameters: { externalUserID: "123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "UNS upstream service unavailable",
      }),
    });
  });

  it("returns 400 for missing query parameters", async ({
    privateGatewayEvent,
  }) => {
    const response = await handler(
      privateGatewayEvent.get("/gateways/uns/v1/notifications"),
      context,
    );

    expect(response).toEqual({
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Missing or invalid externalUserID query parameter",
      }),
    });
  });

  it("returns 500 for unexpected non-HTTP errors", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.notifications.get.mockRejectedValue(
      new Error("Unexpected error"),
    );

    const response = await handler(
      privateGatewayEvent.get("/gateways/uns/v1/notifications", {
        queryStringParameters: { externalUserID: "user-123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal server error" }),
    });
  });

  it("passes through 4xx error with body from remote", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.notifications.get.mockResolvedValue({
      ok: false,
      error: {
        status: 400,
        message: "Bad Request",
        body: { detail: "invalid externalUserID" },
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/uns/v1/notifications", {
        queryStringParameters: { externalUserID: "user-123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Bad Request",
        error: { detail: "invalid externalUserID" },
      }),
    });
  });

  it("passes through 4xx error without body from remote", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.notifications.get.mockResolvedValue({
      ok: false,
      error: {
        status: 404,
        message: "Not Found",
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/uns/v1/notifications", {
        queryStringParameters: { externalUserID: "user-123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Not Found" }),
    });
  });
});
