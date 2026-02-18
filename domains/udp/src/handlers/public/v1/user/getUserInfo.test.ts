import { ContextWithPairwiseId } from "@flex/middlewares";
import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { CONSENT_STATUS } from "../../../../schemas";
import { aggregateUserProfile } from "../../services/aggregateUserProfile";
import { generateDerivedId } from "../../services/derived-id";
import { handler, NotificationSecretContext } from "./getUserInfo";

const mockNotificationId = "mocked-notification-id";

vi.mock("../../services/derived-id", () => ({
  generateDerivedId: vi.fn().mockReturnValue("mocked-notification-id"),
}));
vi.mock("@flex/middlewares");
vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: "https://execute-api.eu-west-2.amazonaws.com",
    }),
  ),
}));
vi.mock("../../services/aggregateUserProfile", () => ({
  aggregateUserProfile: vi.fn(),
}));

type UserGetContext = ContextWithPairwiseId & NotificationSecretContext;

function defaultPreferences(updatedAt: string) {
  return {
    notifications: { consentStatus: CONSENT_STATUS.UNKNOWN, updatedAt },
  };
}

function defaultUserProfile(notificationId: string, updatedAt: string) {
  return {
    notificationId,
    preferences: defaultPreferences(updatedAt),
  };
}

describe("GetUserInfo handler", () => {
  const mockNotificationSecret = {
    notificationSecretKey: "mocked-notification-secret", // pragma: allowlist secret
  };
  const testPairwiseId = "test-pairwise-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful responses", () => {
    it("returns 200 with preferences when user already exists (GET returns 200)", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const updatedAt = new Date().toISOString();

      vi.mocked(aggregateUserProfile).mockResolvedValue({
        notificationId: mockNotificationId,
        preferences: {
          notifications: { consentStatus: CONSENT_STATUS.CONSENTED, updatedAt },
        },
      });

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
            preferences: {
              notifications: {
                consentStatus: CONSENT_STATUS.CONSENTED,
                updatedAt,
              },
            },
          },
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    });

    it("returns 200 with notification ID and preferences when user is created", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const updatedAt = new Date().toISOString();

      vi.mocked(aggregateUserProfile).mockResolvedValue({
        notificationId: mockNotificationId,
        preferences: defaultPreferences(updatedAt),
      });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.ok(defaultUserProfile(mockNotificationId, updatedAt), {
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(aggregateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          region: "eu-west-2",
          baseUrl: new URL("https://execute-api.eu-west-2.amazonaws.com"),
          pairwiseId: testPairwiseId,
          notificationId: mockNotificationId,
        }),
      );
    });

    it("uses pairwiseId from context in requests and response", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const customPairwiseId = "custom-user-id-123";
      const updatedAt = new Date().toISOString();
      vi.mocked(aggregateUserProfile).mockResolvedValue({
        notificationId: mockNotificationId,
        preferences: defaultPreferences(updatedAt),
      });

      const result = await handler(
        eventWithAuthorizer.authenticated({}, customPairwiseId),
        context
          .withPairwiseId(customPairwiseId)
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.ok(defaultUserProfile(mockNotificationId, updatedAt), {
          headers: { "Content-Type": "application/json" },
        }),
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
      const updatedAt = new Date().toISOString();
      vi.mocked(aggregateUserProfile).mockResolvedValue({
        notificationId: mockNotificationId,
        preferences: defaultPreferences(updatedAt),
      });

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
      vi.mocked(aggregateUserProfile).mockRejectedValue(
        new Error("ECONNREFUSED"),
      );

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
