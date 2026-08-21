import type { HttpFixture } from "@flex/testing";
import { it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { handler } from "./gateway";

vi.mock("@flex/sdk", async (importOriginal) => ({
  ...(await importOriginal()),
  createSigv4FetchWithCredentials:
    ({ baseUrl }: { baseUrl: string }) =>
    (path: string, options?: RequestInit) => ({
      request: fetch(`${baseUrl}${path}`, options),
      abort: vi.fn(),
    }),
}));

const mockPushId = "test-push-id";
const mockExternalUserId = "test-external-user-id";
const mockNotificationId = "test-notification-id";
const mockNotification = {
  id: mockNotificationId,
  status: "READ",
  content: "Some content",
};
const mockNotifications = [{ id: mockNotificationId, status: "READ" }];

const mockJoinAction = { Namespace: "travel", Group: "france", Action: "JOIN" };
const mockLeaveAction = {
  Namespace: "travel",
  Group: "spain",
  Subgroup: "majorca",
  Action: "LEAVE",
};
const mockGroupActions = [mockJoinAction, mockLeaveAction];

const mockGroup = { Namespace: "travel", Group: "france" };
const mockSubgroup = {
  Namespace: "travel",
  Group: "spain",
  Subgroup: "instant",
};
const mockGroups = [mockGroup, mockSubgroup];

const mockSecretArn =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:uns-consumer";

const mockConsumerConfig = {
  apiKey: "test-api-key", // pragma: allowlist secret
  apiUrl: "https://uns-api.example.com",
  privateApiUrl: "https://uns-api-private.example.com",
  region: "eu-west-2",
  roleArn: "arn:aws:iam::123456789012:role/uns-consumer-role",
};
const mockAuthHeaders = { "X-API-KEY": mockConsumerConfig.apiKey }; // pragma: allowlist secret

const stubConsumerConfig = (http: HttpFixture) =>
  http
    .url("https://secretsmanager.eu-west-2.amazonaws.com")
    .post("/")
    .reply(200, {
      ARN: mockSecretArn,
      Name: "uns-consumer",
      SecretString: JSON.stringify(mockConsumerConfig),
    });

describe("UNS Service Gateway", () => {
  it.beforeEach(({ env }) => {
    env.set({ FLEX_UNS_CONSUMER_CONFIG_SECRET_ARN: mockSecretArn });
  });

  describe("Error handling", () => {
    it("returns 404 for an unknown route", async ({ platform }) => {
      const result = await handler(
        platform.gatewayEvent.get("/v1/should-throw"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(404, {
          body: { message: "Route not found", type: "client_error" },
        }),
      );
    });

    it("returns 502 when the upstream service returns 5xx", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get("/notifications", {
          headers: mockAuthHeaders,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(500);

      const result = await handler(
        platform.gatewayEvent.get("/v1/notifications", {
          query: { externalUserID: mockExternalUserId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(502, {
          body: {
            message: "UNS upstream service unavailable",
            type: "server_error",
          },
        }),
      );
    });

    it("returns passthrough error provided by the upstream error response", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get("/notifications", {
          headers: mockAuthHeaders,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(400, { key: "value" });

      const result = await handler(
        platform.gatewayEvent.get("/v1/notifications", {
          query: { externalUserID: mockExternalUserId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(400, {
          body: {
            key: "value",
            message: "Bad Request",
            type: "client_error",
            error: { key: "value" },
          },
        }),
      );
    });

    it("returns 400 when a required query parameter is missing", async ({
      platform,
    }) => {
      const result = await handler(
        platform.gatewayEvent.get("/v1/notifications"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(400, {
          body: {
            message: "Invalid query parameters",
            type: "validation_error",
            errors: [
              {
                field: "externalUserID",
                message: "Invalid input: expected string, received undefined",
              },
            ],
          },
        }),
      );
    });
  });

  describe("GET /v1/groups", () => {
    it("returns the group subscriptions list", async ({ http, platform }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get("/v1/groups", {
          headers: mockAuthHeaders,
          query: { pushID: mockPushId },
        })
        .reply(200, mockGroups);

      const result = await handler(
        platform.gatewayEvent.get("/v1/groups", {
          query: { pushID: mockPushId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockGroups }),
      );
    });
  });

  describe("POST /v1/groups", () => {
    it("returns the updated group subscriptions", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .post("/v1/groups", {
          headers: mockAuthHeaders,
          query: { pushID: mockPushId },
          body: mockGroupActions,
        })
        .reply(200, mockGroups);

      const result = await handler(
        platform.gatewayEvent.post("/v1/groups", {
          query: { pushID: mockPushId },
          body: mockGroupActions,
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockGroups }),
      );
    });
  });

  describe("GET /v1/notifications", () => {
    it("returns the notifications list", async ({ http, platform }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get("/notifications", {
          headers: mockAuthHeaders,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(200, mockNotifications);

      const result = await handler(
        platform.gatewayEvent.get("/v1/notifications", {
          query: { externalUserID: mockExternalUserId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockNotifications }),
      );
    });
  });

  describe("GET /v1/notifications/:id", () => {
    it("returns the notification for the given ID", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get(`/notifications/${mockNotificationId}`, {
          headers: mockAuthHeaders,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(200, mockNotification);

      const result = await handler(
        platform.gatewayEvent.get(`/v1/notifications/${mockNotificationId}`, {
          query: { externalUserID: mockExternalUserId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockNotification }),
      );
    });
  });

  describe("PATCH /v1/notifications/:id/status", () => {
    const mockRequestBody = { Status: "READ" };

    it("returns the notification with the updated status", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .patch(`/notifications/${mockNotificationId}/status`, {
          headers: mockAuthHeaders,
          query: { externalUserID: mockExternalUserId },
          body: mockRequestBody,
        })
        .reply(200, mockNotification);

      const result = await handler(
        platform.gatewayEvent.patch(
          `/v1/notifications/${mockNotificationId}/status`,
          {
            query: { externalUserID: mockExternalUserId },
            body: mockRequestBody,
          },
        ),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockNotification }),
      );
    });
  });

  describe("DELETE /v1/notifications/:id", () => {
    it("deletes the notification for the given ID", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .delete(`/notifications/${mockNotificationId}`, {
          headers: mockAuthHeaders,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(204);

      const result = await handler(
        platform.gatewayEvent.delete(
          `/v1/notifications/${mockNotificationId}`,
          { query: { externalUserID: mockExternalUserId } },
        ),
        platform.context(),
      );

      expect(result).toStrictEqual(platform.gatewayResult(204));
    });
  });
});
