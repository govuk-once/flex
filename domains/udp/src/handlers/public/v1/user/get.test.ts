import { ContextWithPairwiseId } from "@flex/middlewares";
import { it } from "@flex/testing";
import { mergeDeepLeft } from "ramda";
import { beforeEach, describe, expect, vi } from "vitest";

import { generateDerivedId } from "../../../../service/derived-id";
import { getUserProfile } from "../../../../service/userProfile";
import { handler, NotificationSecretContext } from "./get";

vi.mock("../../../../service/derived-id", () => ({
  generateDerivedId: vi.fn(),
}));
vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: "https://execute-api.eu-west-2.amazonaws.com",
    }),
  ),
}));
vi.mock("../../../../service/userProfile", () => ({
  getUserProfile: vi.fn(),
}));
vi.mock("@flex/middlewares");

type UserGetContext = ContextWithPairwiseId & NotificationSecretContext;

describe("GET /user handler", () => {
  const mockNotificationSecret = {
    notificationSecretKey: "mocked-notification-secret", // pragma: allowlist secret
  };
  const testPairwiseId = "test-pairwise-id";

  const updatedAt = new Date().toISOString();
  const mockNotificationId = "mocked-notification-id";

  type UserProfileResponse = Awaited<ReturnType<typeof getUserProfile>>;

  const makeUserProfileResponse = (
    overrides: Partial<UserProfileResponse> = {},
  ): UserProfileResponse =>
    mergeDeepLeft(overrides, {
      appId: testPairwiseId,
      notificationId: mockNotificationId,
      preferences: {
        notifications: {
          consentStatus: "unknown",
          updatedAt,
        },
      },
    }) as UserProfileResponse;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when a user profile is found", () => {
    beforeEach(() => {
      vi.mocked(getUserProfile).mockResolvedValue(makeUserProfileResponse());
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);
    });

    it("returns 200 with user profile payload", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const request = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(request).toEqual(
        response.ok(
          {
            appId: testPairwiseId,
            notificationId: mockNotificationId,
            preferences: {
              notifications: {
                consentStatus: "unknown",
                updatedAt,
              },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });

    it("calls getUserProfile with derived notificationId and config", async ({
      eventWithAuthorizer,
      context,
    }) => {
      await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(generateDerivedId).toHaveBeenCalledWith({
        pairwiseId: testPairwiseId,
        secretKey: mockNotificationSecret.notificationSecretKey,
      });
      expect(getUserProfile).toHaveBeenCalledExactlyOnceWith({
        region: "eu-west-2",
        baseUrl: "https://execute-api.eu-west-2.amazonaws.com",
        notificationId: mockNotificationId,
        appId: testPairwiseId,
      });
    });

    it("passes custom pairwiseId as appId to getUserProfile", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const customPairwiseId = "custom-user-id-123";
      const customProfile = makeUserProfileResponse({
        appId: customPairwiseId,
      });
      vi.mocked(getUserProfile).mockResolvedValueOnce(customProfile);

      const request = await handler(
        eventWithAuthorizer.authenticated({}, customPairwiseId),
        context
          .withPairwiseId(customPairwiseId)
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(request).toEqual(
        response.ok(customProfile, {
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
      expect(generateDerivedId).toHaveBeenCalledExactlyOnceWith({
        pairwiseId: customPairwiseId,
        secretKey: mockNotificationSecret.notificationSecretKey,
      });
      expect(getUserProfile).toHaveBeenCalledWith({
        region: "eu-west-2",
        baseUrl: "https://execute-api.eu-west-2.amazonaws.com",
        notificationId: mockNotificationId,
        appId: customPairwiseId,
      });
    });
  });

  describe("service integration", () => {
    it("calls generateDerivedId exactly once per request", async ({
      eventWithAuthorizer,
      context,
    }) => {
      await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(generateDerivedId).toHaveBeenCalledOnce();
    });

    it("bubbles errors from generateDerivedId", async ({
      eventWithAuthorizer,
      context,
      response,
    }) => {
      const error = new Error("generateDerivedId failed");
      vi.mocked(generateDerivedId).mockImplementation(() => {
        throw error;
      });

      await expect(
        handler(
          eventWithAuthorizer.authenticated(),
          context
            .withPairwiseId()
            .withSecret(mockNotificationSecret)
            .create() as UserGetContext,
        ),
      ).resolves.toEqual(
        response.internalServerError(null, {
          headers: {},
        }),
      );
      expect(getUserProfile).not.toHaveBeenCalled();
    });

    it("bubbles errors from getUserProfile", async ({
      eventWithAuthorizer,
      context,
      response,
    }) => {
      const error = new Error("getUserProfile failed");
      vi.mocked(getUserProfile).mockImplementation(() => Promise.reject(error));

      await expect(
        handler(
          eventWithAuthorizer.authenticated(),
          context
            .withPairwiseId()
            .withSecret(mockNotificationSecret)
            .create() as UserGetContext,
        ),
      ).resolves.toEqual(
        response.internalServerError(null, {
          headers: {},
        }),
      );
    });
  });
});
