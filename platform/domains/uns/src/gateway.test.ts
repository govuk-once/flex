import { clearCaches } from "@aws-lambda-powertools/parameters";
import type { HttpFixture } from "@flex/testing";
import { context, it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { handler } from "./gateway";

// TODO: FLEX-344 - Replace all mocks with platform fixtures

// TODO: Move to service gateway setup file
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
const mockHeaders = {
  default: { "Content-Type": "application/json" },
  apiKey: { "X-API-KEY": mockConsumerConfig.apiKey }, // pragma: allowlist secret
};

// TODO: Move to fixtures
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
    clearCaches();
    env.set({ FLEX_UNS_CONSUMER_CONFIG_SECRET_ARN: mockSecretArn });
  });

  describe("Error handling", () => {
    it("returns 404 for an unknown route", async ({ privateGatewayEvent }) => {
      const result = await handler(
        privateGatewayEvent.get("/gateways/uns/v1/should-throw"),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 404,
        headers: mockHeaders.default,
        body: JSON.stringify({ message: "Route not found" }),
      });
    });

    it("returns 502 when the upstream service returns 5xx", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get("/notifications", {
          headers: mockHeaders.apiKey,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(500);

      const result = await handler(
        privateGatewayEvent.get("/gateways/uns/v1/notifications", {
          queryStringParameters: { externalUserID: mockExternalUserId },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 502,
        headers: mockHeaders.default,
        body: JSON.stringify({ message: "UNS upstream service unavailable" }),
      });
    });

    it("returns passthrough error provided by the upstream error response", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get("/notifications", {
          headers: mockHeaders.apiKey,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(400, { key: "value" });

      const result = await handler(
        privateGatewayEvent.get("/gateways/uns/v1/notifications", {
          queryStringParameters: { externalUserID: mockExternalUserId },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 400,
        headers: mockHeaders.default,
        body: JSON.stringify({
          message: "Bad Request",
          error: { key: "value" },
        }),
      });
    });

    it("returns 400 when a required query parameter is missing", async ({
      privateGatewayEvent,
    }) => {
      const result = await handler(
        privateGatewayEvent.get("/gateways/uns/v1/notifications"),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 400,
        headers: mockHeaders.default,
        body: JSON.stringify({
          message: "Invalid query parameters",
          errors: [
            {
              field: "externalUserID",
              message: "Invalid input: expected string, received undefined",
            },
          ],
        }),
      });
    });
  });

  describe("GET /v1/groups", () => {
    it("returns the group subscriptions list", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get("/v1/groups", {
          headers: mockHeaders.apiKey,
          query: { pushID: mockPushId },
        })
        .reply(200, mockGroups);

      const result = await handler(
        privateGatewayEvent.get("/gateways/uns/v1/groups", {
          queryStringParameters: { pushID: mockPushId },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockGroups),
      });
    });
  });

  describe("POST /v1/groups", () => {
    it("returns the updated group subscriptions", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .post("/v1/groups", {
          headers: mockHeaders.apiKey,
          query: { pushID: mockPushId },
          body: mockGroupActions,
        })
        .reply(200, mockGroups);

      const result = await handler(
        privateGatewayEvent.post("/gateways/uns/v1/groups", {
          queryStringParameters: { pushID: mockPushId },
          body: mockGroupActions,
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockGroups),
      });
    });
  });

  describe("GET /v1/notifications", () => {
    it("returns the notifications list", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get("/notifications", {
          headers: mockHeaders.apiKey,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(200, mockNotifications);

      const result = await handler(
        privateGatewayEvent.get("/gateways/uns/v1/notifications", {
          queryStringParameters: { externalUserID: mockExternalUserId },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockNotifications),
      });
    });
  });

  describe("GET /v1/notifications/:id", () => {
    it("returns the notification for the given ID", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .get(`/notifications/${mockNotificationId}`, {
          headers: mockHeaders.apiKey,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(200, mockNotification);

      const result = await handler(
        privateGatewayEvent.get(
          `/gateways/uns/v1/notifications/${mockNotificationId}`,
          { queryStringParameters: { externalUserID: mockExternalUserId } },
        ),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockNotification),
      });
    });
  });

  describe("PATCH /v1/notifications/:id/status", () => {
    const mockRequestBody = { Status: "READ" };

    it("returns the notification with the updated status", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .patch(`/notifications/${mockNotificationId}/status`, {
          headers: mockHeaders.apiKey,
          query: { externalUserID: mockExternalUserId },
          body: mockRequestBody,
        })
        .reply(200, mockNotification);

      const result = await handler(
        privateGatewayEvent.patch(
          `/gateways/uns/v1/notifications/${mockNotificationId}/status`,
          {
            queryStringParameters: { externalUserID: mockExternalUserId },
            body: mockRequestBody,
          },
        ),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockNotification),
      });
    });
  });

  describe("DELETE /v1/notifications/:id", () => {
    it("deletes the notification for the given ID", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.privateApiUrl)
        .delete(`/notifications/${mockNotificationId}`, {
          headers: mockHeaders.apiKey,
          query: { externalUserID: mockExternalUserId },
        })
        .reply(204);

      const result = await handler(
        privateGatewayEvent.delete(
          `/gateways/uns/v1/notifications/${mockNotificationId}`,
          {
            queryStringParameters: { externalUserID: mockExternalUserId },
            body: undefined,
          },
        ),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 204,
        headers: mockHeaders.default,
        body: undefined,
      });
    });
  });
});
