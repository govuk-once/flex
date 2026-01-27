import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { generateDerivedId } from "../../service/derived-id";
import { handler } from "./post";

vi.mock("../../service/derived-id", () => ({
  generateDerivedId: vi.fn(),
}));
vi.mock("@flex/middlewares");

describe("User Creation handler", () => {
  const mockNotificationSecret = "mocked-notification-secret"; // pragma: allowlist secret
  const testPairwiseId = "test-pairwise-id";
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful user creation", () => {
    it("returns 201 with user created message and notification ID", async ({
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
        response.created({
          message: "User created successfully!",
          userId: testPairwiseId,
          notificationId: mockNotificationId,
        }),
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
        secretKey: mockNotificationSecret,
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
        eventWithAuthorizer.authenticated(customPairwiseId),
        context
          .withPairwiseId(customPairwiseId)
          .withSecret(mockNotificationSecret)
          .create(),
      );

      expect(request).toEqual(
        response.created({
          message: "User created successfully!",
          userId: customPairwiseId,
          notificationId: mockNotificationId,
        }),
      );
      expect(generateDerivedId).toHaveBeenCalledWith({
        pairwiseId: customPairwiseId,
        secretKey: mockNotificationSecret,
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
        response.created({
          message: "User created successfully!",
          userId: testPairwiseId,
          notificationId: mockNotificationId,
        }),
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
        response.created({
          message: "User created successfully!",
          userId: testPairwiseId,
          notificationId: mockNotificationId,
        }),
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
  });
});
