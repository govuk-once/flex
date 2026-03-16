import { it } from "@flex/testing/e2e";
import type { GetUserPreferencesResponse } from "@flex/udp-domain";
import { describe, expect, inject } from "vitest";

describe("POC domain", () => {
  const { JWT } = inject("e2eEnv");

  describe("POST /v0/identity/:serviceName/:identifier", () => {
    const endpoint = `/v0/identity/test-service/test-id`;

    it("rejects unauthenticated requests", async ({ cloudfront }) => {
      const result = await cloudfront.client.get(endpoint);

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

  describe("GET /v0/users", () => {
    const endpoint = `/v0/users`;

    it("rejects unauthenticated requests", async ({ cloudfront }) => {
      const result = await cloudfront.client.get(endpoint);

      expect(result.status).toBe(401);
      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
    });

    it("returns 200 with user profile and notification ID", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        userId: expect.any(String) as string,
        notificationId: expect.any(String) as string,
        preferences: {
          notifications: {
            consentStatus: expect.any(String) as string,
            notificationId: expect.any(String) as string,
          },
        },
        newUserProfileEnabled: expect.any(Boolean) as boolean,
      });
    });

    it("returns the expected newUserProfileEnabled flag value for the current stage", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      });

      expect(result.status).toBe(200);
      expect(
        (result.body as Record<string, unknown>).newUserProfileEnabled,
      ).toBe(true);
    });

    it("returns the same notification ID for multiple requests to the same user", async ({
      cloudfront,
    }) => {
      const headers = { Authorization: `Bearer ${JWT.VALID}` };

      const [first, second] = await Promise.all([
        cloudfront.client.get<GetUserPreferencesResponse>(endpoint, {
          headers,
        }),
        cloudfront.client.get<GetUserPreferencesResponse>(endpoint, {
          headers,
        }),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body?.notificationId).toBe(second.body?.notificationId);
    });
  });

  describe("PATCH /v0/users/notifications", () => {
    const endpoint = `/v0/users/notifications`;

    it("rejects unauthenticated requests", async ({ cloudfront }) => {
      const result = await cloudfront.client.get(endpoint);

      expect(result.status).toBe(401);
      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
    });

    it("returns 200 with updated notification preferences", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.patch(endpoint, {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
        body: { consentStatus: "accepted" },
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        consentStatus: "accepted",
        notificationId: expect.any(String) as string,
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
