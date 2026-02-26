import { getConfig } from "@flex/params";
import { context, it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { createUdpRemoteClient } from "../client";
import type { NotificationsResponse } from "../schemas/remote/preferences";
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

const MOCK_REMOTE_NOTIFICATIONS: NotificationsResponse = {
  data: {
    consentStatus: "accepted",
  },
};

const remoteClient = {
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  createUser: vi.fn(),
};

describe("UDP Service Gateway handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockResolvedValue({
      AWS_REGION: "eu-west-2",
      FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: TEST_SECRET_ARN,
    });
    vi.mocked(getConsumerConfig).mockResolvedValue(TEST_CONSUMER_CONFIG);
    vi.mocked(createUdpRemoteClient).mockReturnValue(remoteClient);
  });

  it("dispatches GET /v1/notifications and maps remote response", async ({
    privateGatewayEvent,
    env,
  }) => {
    env.set({
      FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: TEST_SECRET_ARN,
    });
    remoteClient.getPreferences.mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_REMOTE_NOTIFICATIONS,
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/udp/v1/notifications", {
        headers: { "requesting-service-user-id": "pairwise-123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferences: {
          notifications: {
            consentStatus: "accepted",
          },
        },
      }),
    });
    expect(getConsumerConfig).toHaveBeenCalledWith(TEST_SECRET_ARN);
    expect(remoteClient.getPreferences).toHaveBeenCalledWith("pairwise-123");
  });

  it("dispatches POST /v1/notifications with internal consent shape", async ({
    privateGatewayEvent,
    env,
  }) => {
    env.set({
      FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: TEST_SECRET_ARN,
    });
    remoteClient.updatePreferences.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        data: {
          consentStatus: "denied",
        },
      } satisfies NotificationsResponse,
    });

    const response = await handler(
      privateGatewayEvent.post("/gateways/udp/v1/notifications", {
        headers: { "requesting-service-user-id": "pairwise-456" },
        body: {
          preferences: {
            notifications: {
              consentStatus: "denied",
            },
          },
        },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferences: {
          notifications: {
            consentStatus: "denied",
          },
        },
      }),
    });
    expect(remoteClient.updatePreferences).toHaveBeenCalledWith(
      {
        configuration: {
          expiryMechanism: "DELETE",
          expiresAt: expect.any(Number),
        },
        data: { consentStatus: "denied" },
      },
      "pairwise-456",
    );
  });

  it("dispatches POST /v1/user with internal create user shape", async ({
    privateGatewayEvent,
    env,
  }) => {
    env.set({
      FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: TEST_SECRET_ARN,
    });
    remoteClient.createUser.mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "created" },
    });

    const response = await handler(
      privateGatewayEvent.post("/gateways/udp/v1/user", {
        body: {
          notificationId: "notif-123",
          appId: "app-abc",
        },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "created" }),
    });
    expect(remoteClient.createUser).toHaveBeenCalledWith({
      notificationId: "notif-123",
      appId: "app-abc",
    });
  });

  it("maps remote 5xx errors to 502 with sanitized message", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.getPreferences.mockResolvedValue({
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
    remoteClient.getPreferences.mockResolvedValue({
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

  it("returns 400 when required requesting-service-user-id header is missing", async ({
    privateGatewayEvent,
    env,
  }) => {
    env.set({
      FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: TEST_SECRET_ARN,
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/udp/v1/notifications"),
      context,
    );

    expect(response).toEqual({
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Missing requesting-service-user-id header",
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

  it("returns 500 for unexpected non-http errors", async ({
    privateGatewayEvent,
  }) => {
    vi.mocked(getConfig).mockRejectedValueOnce(new Error("unexpected failure"));

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
      body: JSON.stringify({
        message: "Internal server error",
      }),
    });
  });
});
