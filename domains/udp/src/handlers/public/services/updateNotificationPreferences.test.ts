import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_STATUS } from "../../../schemas";
import { updateNotificationPreferences } from "./updateNotificationPreferences";

const mockGatewayFetch = vi.fn();

vi.mock("../../../client", () => ({
  createUdpDomainClient: () => ({
    gateway: {
      postNotifications: mockGatewayFetch,
    },
  }),
}));

describe("updateNotificationPreferences", () => {
  const pairwiseId = "test-pairwise-id";
  const updatedAt = "2025-01-15T10:00:00Z";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGatewayFetch.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
  });

  describe("successful updates", () => {
    it.each([
      CONSENT_STATUS.UNKNOWN,
      CONSENT_STATUS.CONSENTED,
      CONSENT_STATUS.NOT_CONSENTED,
    ])("supports all consent status values", async (consentStatus) => {
      const response = await updateNotificationPreferences({
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        awsRegion: "eu-west-2",
        pairwiseId,
        consentStatus,
        updatedAt,
      });

      expect(response.status).toBe(200);

      const callArgs = mockGatewayFetch.mock.calls[0]?.[0] as {
        request: { body: unknown };
      };

      expect(callArgs).toMatchObject({
        data: {
          consentStatus,
          updatedAt,
        },
      });
    });
  });

  describe("error handling", () => {
    it("returns gateway 500 response", async () => {
      mockGatewayFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: "Internal Server Error" }), {
          status: 500,
        }),
      );

      const response = await updateNotificationPreferences({
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        awsRegion: "eu-west-2",
        pairwiseId,
        consentStatus: CONSENT_STATUS.CONSENTED,
        updatedAt,
      });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        message: "Internal Server Error",
      });
    });

    it("propagates network errors", async () => {
      mockGatewayFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(
        updateNotificationPreferences({
          privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
          awsRegion: "eu-west-2",
          pairwiseId,
          consentStatus: CONSENT_STATUS.CONSENTED,
          updatedAt,
        }),
      ).rejects.toThrow();
    });
  });
});
