import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe.todo("UDP domain", () => {
  const { JWT } = inject("e2eEnv");
  const domainVersion = "v1";
  const endpoint = `/${domainVersion}/user`;

  describe("/get user", () => {
    it("returns a 200 and notification ID", async ({ cloudfront }) => {
      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      });

      expect(response).toMatchObject({
        status: 200,
        body: {
          notificationId: expect.any(String) as string,
        },
      });
    });

    it("returns the same notification ID for the same user", async ({
      cloudfront,
    }) => {
      const request = cloudfront.client.get<{ notificationId: string }>(
        endpoint,
        {
          headers: { Authorization: `Bearer ${JWT.VALID}` },
        },
      );

      const [response1, response2] = await Promise.all([request, request]);

      expect(response1.body?.notificationId).toBe(
        response2.body?.notificationId,
      );
    });
  });

  describe("/patch user", () => {
    it("returns user preferences updated successfully", async ({
      cloudfront,
    }) => {
      const response = await cloudfront.client.patch(endpoint, {
        body: {
          preferences: {
            notifications: {
              consentStatus: "accepted",
            },
          },
        },
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        preferences: {
          notifications: {
            consentStatus: "accepted",
          },
        },
      });
    });

    it("rejects invalid payloads", async ({ cloudfront }) => {
      const response = await cloudfront.client.patch(endpoint, {
        body: {
          preferences: {
            notifications: {
              consentStatus: "yes",
            },
          },
        },
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      });

      expect(response).toMatchObject({
        status: 400,
      });
    });
  });
});
