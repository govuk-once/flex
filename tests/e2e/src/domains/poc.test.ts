import { it } from "@flex/testing/e2e";
import type {
  UpdateNotificationPreferencesOutboundResponse,
  UpdateNotificationPreferencesRequest,
} from "@flex/udp-domain";
import { describe, expect, inject } from "vitest";

describe("POC domain", () => {
  const { JWT } = inject("e2eEnv");

  describe("POST /poc/v0/identity/:service/:id", () => {
    const endpoint = `/poc/v0/identity/test-service/test-id`;

    it("rejects unauthenticated requests", async ({ cloudfront }) => {
      const result = await cloudfront.client.post(endpoint);

      expect(result.status).toBe(401);
      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
    });

    it("returns 201 when identity is linked successfully", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.post(endpoint, {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      });

      expect(result.status).toBe(201);
    });
  });

  describe("PATCH /poc/v0/users/notifications", () => {
    const endpoint = `/poc/v0/users/notifications`;

    it("rejects unauthenticated requests", async ({ cloudfront }) => {
      const result = await cloudfront.client.get(endpoint);

      expect(result.status).toBe(401);
      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
    });

    it("returns 200 with updated notification preferences", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.patch<
        UpdateNotificationPreferencesRequest,
        UpdateNotificationPreferencesOutboundResponse
      >(endpoint, {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
        body: { consentStatus: "accepted" },
      });

      expect(result.status).toBe(200);
      expect(result.body).toStrictEqual({
        consentStatus: "accepted",
        notificationId: expect.any(String) as string,
        featureFlags: {
          newUserProfileEnabled: expect.any(Boolean) as boolean,
        },
      });
    });

    it.for([
      {
        body: { consentStatus: "invalid" },
        reason: "includes an unrecognised consent status",
      },
      { body: {}, reason: "is empty" },
    ])(
      "rejects request when body $reason",
      async ({ body }, { cloudfront }) => {
        const result = await cloudfront.client.patch(endpoint, {
          headers: { Authorization: `Bearer ${JWT.VALID}` },
          body,
        });

        expect(result.status).toBe(400);
      },
    );
  });
});
