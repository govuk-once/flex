import { ContextWithUserId } from "@flex/middlewares";
import { createUserId, it } from "@flex/testing";
import { NotificationSecretContext } from "@schemas/notifications";
import { getNotificationId } from "@services/getNotificationId";
import { getUserProfile } from "@services/userProfile";
import { testNotificationId } from "@test/fixtures";
import type { NotificationId } from "@types";
import { mergeDeepLeft } from "ramda";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@services/getNotificationId");
vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: "https://execute-api.eu-west-2.amazonaws.com",
    }),
  ),
}));
vi.mock("@services/userProfile", () => ({
  getUserProfile: vi.fn(),
}));
vi.mock("@flex/middlewares");

type UserGetContext = ContextWithUserId & NotificationSecretContext;

describe("GET /user handler", () => {
  const mockNotificationSecret = {
    notificationSecretKey: "mocked-notification-secret", // pragma: allowlist secret
  };
  const testPairwiseId = "test-pairwise-id";

  const mockNotificationId = "mocked-notification-id";

  type UserProfileResponse = Awaited<ReturnType<typeof getUserProfile>>;

  const makeUserProfileResponse = (
    overrides: Partial<UserProfileResponse> = {},
  ): UserProfileResponse =>
    mergeDeepLeft(overrides, {
      userId: testPairwiseId,
      notificationId: mockNotificationId,
      preferences: {
        notifications: {
          consentStatus: "unknown",
        },
      },
    }) as UserProfileResponse;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when a user profile is found", () => {
    beforeEach(() => {
      vi.mocked(getUserProfile).mockResolvedValue(makeUserProfileResponse());
    });

    it("returns 200 with user profile payload", async ({
      response,
      privateGatewayEventWithAuthorizer,
      context,
    }) => {
      const request = await handler(
        privateGatewayEventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(request).toEqual(
        response.ok(
          {
            userId: testPairwiseId,
            notificationId: mockNotificationId,
            preferences: {
              notifications: {
                consentStatus: "unknown",
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
      privateGatewayEventWithAuthorizer,
      context,
    }) => {
      await handler(
        privateGatewayEventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(getNotificationId).toHaveBeenCalledWith({
        userId: testPairwiseId,
        secretKey: mockNotificationSecret.notificationSecretKey,
      });
      expect(getUserProfile).toHaveBeenCalledExactlyOnceWith({
        region: "eu-west-2",
        baseUrl: "https://execute-api.eu-west-2.amazonaws.com",
        notificationId: testNotificationId,
        userId: testPairwiseId,
      });
    });

    it("passes custom pairwiseId as userId to getUserProfile", async ({
      response,
      privateGatewayEventWithAuthorizer,
      context,
    }) => {
      const customPairwiseId = createUserId("custom-user-id-123");
      const customProfile = makeUserProfileResponse({
        userId: customPairwiseId,
      });
      vi.mocked(getUserProfile).mockResolvedValueOnce(customProfile);

      const request = await handler(
        privateGatewayEventWithAuthorizer.authenticated({}, customPairwiseId),
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
      expect(getNotificationId).toHaveBeenCalledExactlyOnceWith({
        userId: customPairwiseId,
        secretKey: mockNotificationSecret.notificationSecretKey,
      });
      expect(getUserProfile).toHaveBeenCalledWith({
        region: "eu-west-2",
        baseUrl: "https://execute-api.eu-west-2.amazonaws.com",
        notificationId: testNotificationId,
        userId: customPairwiseId,
      });
    });
  });

  describe("service integration", () => {
    it("calls getNotificationId exactly once per request", async ({
      privateGatewayEventWithAuthorizer,
      context,
    }) => {
      await handler(
        privateGatewayEventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(getNotificationId).toHaveBeenCalledOnce();
    });

    it("bubbles errors from getNotificationId", async ({
      privateGatewayEventWithAuthorizer,
      context,
      response,
    }) => {
      const error = new Error("getNotificationId failed");
      vi.mocked(getNotificationId).mockImplementation(() => {
        throw error;
      });

      await expect(
        handler(
          privateGatewayEventWithAuthorizer.authenticated(),
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
      privateGatewayEventWithAuthorizer,
      context,
      response,
    }) => {
      const error = new Error("getUserProfile failed");
      vi.mocked(getUserProfile).mockImplementation(() => Promise.reject(error));

      await expect(
        handler(
          privateGatewayEventWithAuthorizer.authenticated(),
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
