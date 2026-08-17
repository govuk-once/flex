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
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:udp-consumer";

const mockConsumerConfig = {
  apiAccountId: "123456789012",
  apiKey: "test-api-key", // pragma: allowlist secret
  apiUrl: "https://udp-api.example.com",
  consumerRoleArn: "arn:aws:iam::123456789012:role/udp-consumer-role",
  region: "eu-west-2",
  externalId: "test-external-id",
};
const mockHeaders = {
  apiKey: { "x-api-key": mockConsumerConfig.apiKey }, // pragma: allowlist secret
  withServiceUserId: (requestingServiceUserId: string) => ({
    "x-api-key": mockConsumerConfig.apiKey,
    "requesting-service": "app",
    "requesting-service-user-id": requestingServiceUserId,
  }),
};
const mockUpstreamGroups = {
  data: {
    groups: [
      { Namespace: "travel", Group: "test country", Type: "NOTIFICATION" },
      {
        Namespace: "travel",
        Group: "test country",
        Subgroup: "test frequency",
        Type: "NOTIFICATION",
      },
    ],
  },
};
const mockGroupsBody = [
  { Namespace: "travel", Group: "test country", Type: "NOTIFICATION" as const },
];

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
    env.set({ FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN: mockSecretArn });
  });

  describe("Error handling", () => {
    it("returns 404 for an unknown route", async ({ platform }) => {
      const result = await handler(
        platform.gatewayEvent.get("/v1/should-throw"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(404, { body: { message: "Route not found" } }),
      );
    });

    it("returns 502 when the upstream service returns 5xx", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.apiUrl)
        .get("/v1/notifications", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
        })
        .reply(500);

      const result = await handler(
        platform.gatewayEvent.get("/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(502, {
          body: { message: "UDP upstream service unavailable" },
        }),
      );
    });

    it("returns passthrough error provided by the upstream error response", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.apiUrl)
        .get("/v1/notifications", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
        })
        .reply(404, { key: "value" });

      const result = await handler(
        platform.gatewayEvent.get("/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(404, {
          body: { message: "Not Found", error: { key: "value" } },
        }),
      );
    });

    it("returns 400 when a required header is missing", async ({
      platform,
    }) => {
      const result = await handler(
        platform.gatewayEvent.get("/v1/notifications"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(400, {
          body: {
            message: "Missing headers: requesting-service-user-id",
            headers: ["requesting-service-user-id"],
          },
        }),
      );
    });
  });

  describe("GET /v1/identities/:id", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the linked services for the given ID", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .get(`/v1/identity/app/${mockUserId}/linked-services`, {
          headers: mockHeaders.apiKey,
        })
        .reply(200, mockIdentities);

      const result = await handler(
        platform.gatewayEvent.get(`/v1/identities/${mockUserId}`),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockIdentities }),
      );
    });
  });

  describe("GET /v1/identity/:serviceName", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the identity link for the given service", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .get("/v1/identity/exchange", {
          headers: mockHeaders.withServiceUserId(mockUserId),
          query: { requiredService: mockService },
        })
        .reply(200, mockIdentityLink);

      const result = await handler(
        platform.gatewayEvent.get(`/v1/identity/${mockService}`, {
          headers: { "User-Id": mockUserId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockIdentityLink }),
      );
    });
  });

  describe("GET /v1/notifications", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the notification preferences for the requesting user", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .get("/v1/notifications", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
        })
        .reply(200, mockUpstreamNotifications);

      const result = await handler(
        platform.gatewayEvent.get("/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockNotifications }),
      );
    });
  });

  describe("POST /v1/identity/:serviceName/:identifier", () => {
    const now = new Date("2026-08-13T00:00:00.000Z");
    const sixtyDaysInSeconds = 60 * 24 * 60 * 60;
    const mockExpiresAt = Math.floor(now.getTime() / 1000) + sixtyDaysInSeconds;

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
      vi.useFakeTimers();
      vi.setSystemTime(now);

      return () => {
        vi.useRealTimers();
      };
    });

    it("links the service identity for the requesting user", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post(`/v1/identity/${mockService}/${mockIdentity}`, {
          headers: mockHeaders.apiKey,
          body: { appId: mockUserId, expiresAt: mockExpiresAt },
        })
        .reply(201);

      const result = await handler(
        platform.gatewayEvent.post(
          `/v1/identity/${mockService}/${mockIdentity}`,
          { body: { appId: mockUserId } },
        ),
        platform.context(),
      );

      expect(result).toStrictEqual(platform.gatewayResult(201));
    });
  });

  describe("POST /v1/notifications", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the updated notification preferences for the requesting user", async ({
      http,
      platform,
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
        platform.gatewayEvent.post("/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
          body: { consentStatus: "accepted" },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockNotifications }),
      );
    });
  });

  describe("POST /v1/users", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    const mockCreatedUser = { message: "User created" };

    it("returns the created user", async ({ http, platform }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/v1/user", {
          headers: mockHeaders.apiKey,
          body: { pushId: mockPushId, appId: mockUserId },
        })
        .reply(200, mockCreatedUser);

      const result = await handler(
        platform.gatewayEvent.post("/v1/users", {
          body: { pushId: mockPushId, userId: mockUserId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockCreatedUser }),
      );
    });
  });

  describe("DELETE /v1/identity/:serviceName/:identifier", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("unlinks the service identity", async ({ http, platform }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .delete(`/v1/identity/${mockService}/${mockIdentity}`, {
          headers: mockHeaders.apiKey,
        })
        .reply(204);

      const result = await handler(
        platform.gatewayEvent.delete(
          `/v1/identity/${mockService}/${mockIdentity}`,
        ),
        platform.context(),
      );

      expect(result).toStrictEqual(platform.gatewayResult(204));
    });
  });

  describe("DELETE /v1/notifications", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("deletes the notification preferences for the requesting user", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .delete("/v1/notifications", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
        })
        .reply(204);

      const result = await handler(
        platform.gatewayEvent.delete("/v1/notifications", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(platform.gatewayResult(204));
    });
  });

  describe("GET /v1/groups", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });
    const mockGroups = mockUpstreamGroups.data.groups;

    it("returns the group subscriptions for the requesting user", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .get("/v1/groups", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
        })
        .reply(200, mockUpstreamGroups);

      const result = await handler(
        privateGatewayEvent.get("/gateways/udp/v1/groups", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
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
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    const mockUpstreamGroupsResponse = {
      data: {
        groups: mockGroupsBody,
      },
    };

    it("returns the updated group subscriptions for the requesting user", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/v1/groups", {
          headers: mockHeaders.withServiceUserId(mockRequestingServiceUserId),
          body: {
            data: {
              groups: mockGroupsBody,
            },
            requestingServiceUserId: mockRequestingServiceUserId,
          },
        })
        .reply(200, mockUpstreamGroupsResponse);

      const result = await handler(
        privateGatewayEvent.post("/gateways/udp/v1/groups", {
          headers: {
            "requesting-service-user-id": mockRequestingServiceUserId,
          },
          body: mockGroupsBody,
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockGroupsBody),
      });
    });
  });
});
