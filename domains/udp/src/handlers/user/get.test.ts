import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { generateDerivedId } from "../../service/derived-id";
import { handler } from "./get";

vi.mock("../../service/derived-id", () => ({
  generateDerivedId: vi.fn(),
}));
vi.mock("@flex/middlewares");

describe("GET /user handler", () => {
  const mockNotificationSecret = {
    notificationSecretKey: "mocked-notification-secret", // pragma: allowlist secret
  };
  const testPairwiseId = "test-pairwise-id";
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful user get", () => {
    it("returns 200 with notification ID", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      const request = await handler(
        eventWithAuthorizer.authenticated(),
        context.withPairwiseId().withSecret(mockNotificationSecret).create(),
      );

      expect(request).toEqual(
        response.ok(
          {
            notification_id: mockNotificationId,
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
        context.withPairwiseId().withSecret(mockNotificationSecret).create(),
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
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      const request = await handler(
        eventWithAuthorizer.authenticated({}, customPairwiseId),
        context
          .withPairwiseId(customPairwiseId)
          .withSecret(mockNotificationSecret)
          .create(),
      );

      expect(request).toEqual(
        response.ok(
          {
            notification_id: mockNotificationId,
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

    it("returns response with correct status code", async ({
      eventWithAuthorizer,
      response,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      const request = await handler(
        eventWithAuthorizer.authenticated(),
        context.withPairwiseId().withSecret(mockNotificationSecret).create(),
      );

      expect(request).toEqual(
        response.ok(
          {
            notification_id: mockNotificationId,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });

    it("returns properly formatted JSON body", async ({
      eventWithAuthorizer,
      context,
      response,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      const request = await handler(
        eventWithAuthorizer.authenticated(),
        context.withPairwiseId().withSecret(mockNotificationSecret).create(),
      );

      expect(request).toEqual(
        response.ok(
          {
            notification_id: mockNotificationId,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
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
        context.withPairwiseId().withSecret(mockNotificationSecret).create(),
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
          context.withPairwiseId().withSecret(mockNotificationSecret).create(),
        ),
      ).resolves.toEqual(
        response.internalServerError(null, {
          headers: {},
        }),
      );
    });
  });
});
