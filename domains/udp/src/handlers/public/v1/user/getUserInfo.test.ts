import { ContextWithPairwiseId } from "@flex/middlewares";
import { it } from "@flex/testing";
import nock from "nock";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { SERVICE_NAME } from "../../../../constants";
import { generateDerivedId } from "../../../../services/derived-id";
import { handler, NotificationSecretContext } from "./getUserInfo";

const PRIVATE_GATEWAY_ORIGIN = "https://execute-api.eu-west-2.amazonaws.com";

/**
 * Paths must match actual URLs from sigv4 fetch.
 * baseUrl ends with trailing slash (e.g. .../gateways/udp/v1/), so path
 * "notifications" resolves to .../gateways/udp/v1/notifications.
 */
const PATHS = {
  notifications: "/gateways/udp/v1/notifications",
  user: "/domains/udp/v1/user",
} as const;

vi.mock("../../../../services/derived-id", () => ({
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
      // Second call to getUserSettings (aggregateUserProfile always calls it again)
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
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

      // setDefaultUserSettings: POST notifications
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.notifications).reply(200);

      // Second getUserSettings: GET notifications
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
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
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
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
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
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
