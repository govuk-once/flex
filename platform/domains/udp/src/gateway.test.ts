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

const mockUserId = "test-user-id";
const mockPushId = "test-push-id";
const mockService = "test-service";
const mockIdentity = "test-identity";
const mockIdentityLink = { identity: mockIdentity };
const mockLinkedService = "dvla";
const mockIdentities = { linkedService: [mockLinkedService] };
const mockRequestingServiceUserId = "test-requesting-service-user-id";
const mockUpstreamNotifications = {
  data: { consentStatus: "accepted", pushId: mockPushId },
};
const mockNotifications = { consentStatus: "accepted", pushId: mockPushId };

const mockSecretArn =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:dvla-consumer";

const mockConsumerConfig = {
  apiAccountId: "123456789012",
  apiKey: "test-api-key", // pragma: allowlist secret
  apiUrl: "https://udp-api.example.com",
  consumerRoleArn: "arn:aws:iam::123456789012:role/udp-consumer-role",
  region: "eu-west-2",
  externalId: "test-external-id",
};
const mockHeaders = {
  default: { "Content-Type": "application/json" },
  apiKey: { "x-api-key": mockConsumerConfig.apiKey }, // pragma: allowlist secret
  withServiceUserId: (requestingServiceUserId: string) => ({
    "x-api-key": mockConsumerConfig.apiKey,
    "requesting-service": "app",
    "requesting-service-user-id": requestingServiceUserId,
  }),
};

// TODO: Move to fixtures
const stubConsumerConfig = (http: HttpFixture) =>
  http
    .url("https://secretsmanager.eu-west-2.amazonaws.com")
    .post("/")
    .reply(200, {
      ARN: mockSecretArn,
      Name: "udp-consumer",
      SecretString: JSON.stringify(mockConsumerConfig),
    });

describe("UDP Service Gateway", () => {
  it.beforeEach(({ env }) => {
    clearCaches();
    env.set({ FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: mockSecretArn });
  });

  describe("Error handling", () => {
    it("returns 404 for an unknown route", async ({ privateGatewayEvent }) => {
      const result = await handler(
        privateGatewayEvent.get("/gateways/udp/v1/should-throw"),
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
        .url(mockConsumerConfig.apiUrl)
        .get("/v1/notifications", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
        })
        .reply(500);

      const result = await handler(
        privateGatewayEvent.get("/gateways/udp/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 502,
        headers: mockHeaders.default,
        body: JSON.stringify({ message: "UDP upstream service unavailable" }),
      });
    });

    it("returns passthrough error provided by the upstream error response", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.apiUrl)
        .get("/v1/notifications", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
        })
        .reply(404, { key: "value" });

      const result = await handler(
        privateGatewayEvent.get("/gateways/udp/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 404,
        headers: mockHeaders.default,
        body: JSON.stringify({ message: "Not Found", error: { key: "value" } }),
      });
    });

    it("returns 400 when a required header is missing", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      const result = await handler(
        privateGatewayEvent.get("/gateways/udp/v1/notifications"),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 400,
        headers: mockHeaders.default,
        body: JSON.stringify({
          message: "Missing headers: requesting-service-user-id",
          headers: ["requesting-service-user-id"],
        }),
      });
    });
  });

  describe("GET /v1/identities/:id", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the linked services for the given ID", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .get(`/v1/identity/app/${mockUserId}/linked-services`, {
          headers: mockHeaders.apiKey,
        })
        .reply(200, mockIdentities);

      const result = await handler(
        privateGatewayEvent.get(`/gateways/udp/v1/identities/${mockUserId}`),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockIdentities),
      });
    });
  });

  describe("GET /v1/identity/:serviceName", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the identity link for the given service", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .get("/v1/identity/exchange", {
          headers: mockHeaders.withServiceUserId(mockUserId),
          query: { requiredService: mockService },
        })
        .reply(200, mockIdentityLink);

      const result = await handler(
        privateGatewayEvent.get(`/gateways/udp/v1/identity/${mockService}`, {
          headers: { "User-id": mockUserId },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockIdentityLink),
      });
    });
  });

  describe("GET /v1/notifications", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the notification preferences for the requesting user", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .get("/v1/notifications", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
        })
        .reply(200, mockUpstreamNotifications);

      const result = await handler(
        privateGatewayEvent.get("/gateways/udp/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
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

  describe("POST /v1/identity/:serviceName/:identifier", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("links the service identity for the requesting user", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post(`/v1/identity/${mockService}/${mockIdentity}`, {
          headers: mockHeaders.apiKey,
          body: { appId: mockUserId },
        })
        .reply(201);

      const result = await handler(
        privateGatewayEvent.post(
          `/gateways/udp/v1/identity/${mockService}/${mockIdentity}`,
          { body: { appId: mockUserId } },
        ),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 201,
        headers: mockHeaders.default,
        body: undefined,
      });
    });
  });

  describe("POST /v1/notifications", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the updated notification preferences for the requesting user", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/v1/notifications", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
          body: {
            data: { consentStatus: "accepted" },
            requestingServiceUserId: mockRequestingServiceUserId,
          },
        })
        .reply(200, mockUpstreamNotifications);

      const result = await handler(
        privateGatewayEvent.post("/gateways/udp/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
          body: { consentStatus: "accepted" },
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

  describe("POST /v1/users", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    const mockCreatedUser = { message: "User created" };

    it("returns the created user", async ({ http, privateGatewayEvent }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/v1/user", {
          headers: mockHeaders.apiKey,
          body: { pushId: mockPushId, appId: mockUserId },
        })
        .reply(200, mockCreatedUser);

      const result = await handler(
        privateGatewayEvent.post("/gateways/udp/v1/users", {
          body: { pushId: mockPushId, userId: mockUserId },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockCreatedUser),
      });
    });
  });

  describe("DELETE /v1/identity/:serviceName/:identifier", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("unlinks the service identity", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .delete(`/v1/identity/${mockService}/${mockIdentity}`, {
          headers: mockHeaders.apiKey,
        })
        .reply(204);

      const result = await handler(
        privateGatewayEvent.delete(
          `/gateways/udp/v1/identity/${mockService}/${mockIdentity}`,
          { body: undefined },
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

  describe("DELETE /v1/notifications", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("deletes the notification preferences for the requesting user", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .delete("/v1/notifications", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
        })
        .reply(204);

      const result = await handler(
        privateGatewayEvent.delete("/gateways/udp/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
          body: undefined,
        }),
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
