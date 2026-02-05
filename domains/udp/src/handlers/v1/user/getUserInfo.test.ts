import { ContextWithPairwiseId } from "@flex/middlewares";
import { it } from "@flex/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { generateDerivedId } from "../../../service/derived-id";
import { handler, NotificationSecretContext } from "./getUserInfo";

vi.mock("../../../service/derived-id", () => ({
  generateDerivedId: vi.fn(),
}));
vi.mock("@flex/middlewares");
vi.mock("@flex/params", () => {
  return {
    getConfig: vi.fn(() => ({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL:
        "https://execute-api.eu-west-2.amazonaws.com/gateways/udp",
    })),
  };
});
vi.mock("aws-sigv4-fetch", () => {
  return {
    createSignedFetcher: vi.fn(() => {
      return vi.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        ok: true,
      });
    }),
  };
});

type UserGetContext = ContextWithPairwiseId & NotificationSecretContext;

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
  });

  describe("successful user get", () => {
    it("returns 200 with notification ID and preferences", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

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
            notificationId: mockNotificationId,
            preferences: {
              notificationsConsented: true,
              analyticsConsented: true,
              updatedAt: new Date().toISOString(),
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

    it("calls generateDerivedId with correct parameters", async ({
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

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
    });

    it("uses the pairwiseId from context in the response", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const customPairwiseId = "custom-user-id-123";
      const mockNotificationId = "generated-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      const request = await handler(
        eventWithAuthorizer.authenticated({}, customPairwiseId),
        context
          .withPairwiseId(customPairwiseId)
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(request).toEqual(
        response.ok(
          {
            notificationId: mockNotificationId,
            preferences: {
              notificationsConsented: true,
              analyticsConsented: true,
              updatedAt: new Date().toISOString(),
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
      expect(generateDerivedId).toHaveBeenCalledWith({
        pairwiseId: customPairwiseId,
        secretKey: mockNotificationSecret.notificationSecretKey,
      });
    });
  });

  describe("service integration", () => {
    it("calls generateDerivedId exactly once per request", async ({
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(generateDerivedId).toHaveBeenCalledTimes(1);
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
    });
  });
});
