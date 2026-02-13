import { ContextWithPairwiseId } from "@flex/middlewares";
import { it } from "@flex/testing";
import nock from "nock";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { SERVICE_NAME } from "../../../../constants";
import { generateDerivedId } from "../../../../service/derived-id";
import { handler, NotificationSecretContext } from "./getUserInfo";

const PRIVATE_GATEWAY_ORIGIN = "https://execute-api.eu-west-2.amazonaws.com";

/**
 * Paths must match actual URLs from sigv4 fetch.
 * With baseUrl ".../gateways/udp/v1" and path "notifications", URL resolution
 * replaces the last segment → .../gateways/udp/notifications
 */
const PATHS = {
  notifications: "/gateways/udp/notifications",
  analytics: "/gateways/udp/analytics",
  user: "/domains/udp/user",
} as const;

vi.mock("../../../../service/derived-id", () => ({
  generateDerivedId: vi.fn(),
}));
vi.mock("@flex/middlewares");
vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: PRIVATE_GATEWAY_ORIGIN,
    }),
  ),
}));
vi.mock("aws-sigv4-fetch", () => ({
  createSignedFetcher: vi.fn(() => fetch),
}));

type UserGetContext = ContextWithPairwiseId & NotificationSecretContext;

function defaultPreferences(updatedAt: string) {
  return {
    notifications: { consentStatus: "unknown", updatedAt },
    analytics: { consentStatus: "unknown", updatedAt },
  };
}

describe("GetUserInfo handler", () => {
  const mockNotificationSecret = {
    notificationSecretKey: "mocked-notification-secret", // pragma: allowlist secret
  };
  const testPairwiseId = "test-pairwise-id";

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  describe("successful responses", () => {
    it("returns 200 with preferences when user already exists (GET returns 200)", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      const updatedAt = new Date().toISOString();
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      // First call to getUserSettings
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.analytics)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });
      // Second call to getUserSettings (aggregateUserProfile always calls it again)
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.analytics)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.user).reply(201, {});

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.ok(
          {
            notificationId: mockNotificationId,
            preferences: defaultPreferences(updatedAt),
          },
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    });

    it("returns 200 with notification ID and preferences when user is created (GET 404 → POST create → set defaults → GET)", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      const updatedAt = new Date().toISOString();
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      // First getUserSettings: GET notifications → 404
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .matchHeader("requesting-service", SERVICE_NAME)
        .matchHeader("requesting-service-user-id", testPairwiseId)
        .reply(404);

      // createUserOrchestrator: POST create user
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(PATHS.user, {
          notificationId: mockNotificationId,
          appId: testPairwiseId,
        })
        .reply(201, {});

      // setDefaultUserSettings: POST notifications and analytics
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.notifications).reply(200);
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.analytics).reply(200);

      // Second getUserSettings: GET notifications and analytics
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.analytics)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.ok(
          {
            notificationId: mockNotificationId,
            preferences: defaultPreferences(updatedAt),
          },
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    });

    it("uses pairwiseId from context in requests and response", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const customPairwiseId = "custom-user-id-123";
      const mockNotificationId = "generated-notification-id";
      const updatedAt = new Date().toISOString();
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .matchHeader("requesting-service-user-id", customPairwiseId)
        .reply(404);
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(PATHS.user, {
          notificationId: mockNotificationId,
          appId: customPairwiseId,
        })
        .reply(201, {});
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.notifications).reply(200);
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.analytics).reply(200);
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.analytics)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });

      const result = await handler(
        eventWithAuthorizer.authenticated({}, customPairwiseId),
        context
          .withPairwiseId(customPairwiseId)
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.ok(
          {
            notificationId: mockNotificationId,
            preferences: defaultPreferences(updatedAt),
          },
          { headers: { "Content-Type": "application/json" } },
        ),
      );
      expect(generateDerivedId).toHaveBeenCalledWith({
        pairwiseId: customPairwiseId,
        secretKey: mockNotificationSecret.notificationSecretKey,
      });
    });

    it("calls generateDerivedId exactly once per request", async ({
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      const updatedAt = new Date().toISOString();
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      nock(PRIVATE_GATEWAY_ORIGIN).get(PATHS.notifications).reply(404);
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.user).reply(201, {});
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.notifications).reply(200);
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.analytics).reply(200);
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.analytics)
        .reply(200, { data: { consentStatus: "unknown", updatedAt } });

      await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(generateDerivedId).toHaveBeenCalledTimes(1);
    });
  });

  describe("gateway errors (502)", () => {
    it("returns 502 when GET notifications returns 500", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(generateDerivedId).mockReturnValue("mocked-notification-id");

      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .reply(500, { error: "Internal Server Error" });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toMatchObject({ statusCode: 502 });
    });

    it("returns 502 when GET notifications returns 403", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(generateDerivedId).mockReturnValue("mocked-notification-id");

      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .reply(403, { error: "Forbidden" });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toMatchObject({ statusCode: 502 });
    });

    it("returns 502 when POST create user returns 500", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(generateDerivedId).mockReturnValue("mocked-notification-id");

      nock(PRIVATE_GATEWAY_ORIGIN).get(PATHS.notifications).reply(404);
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(PATHS.user)
        .reply(500, { error: "Internal Server Error" });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(expect.objectContaining({ statusCode: 502 }));
    });
  });

  describe("other errors (500)", () => {
    it("returns 500 when generateDerivedId throws", async ({
      eventWithAuthorizer,
      context,
      response,
    }) => {
      vi.mocked(generateDerivedId).mockImplementation(() => {
        throw new Error("generateDerivedId failed");
      });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.internalServerError(
          { message: "Failed to get user info" },
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    });

    it("returns 500 when network request fails", async ({
      eventWithAuthorizer,
      context,
      response,
    }) => {
      vi.mocked(generateDerivedId).mockReturnValue("mocked-notification-id");
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .replyWithError("ECONNREFUSED");

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.internalServerError(
          { message: "Failed to get user info" },
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    });
  });
});
