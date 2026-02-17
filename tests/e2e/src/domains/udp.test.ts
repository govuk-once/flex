import { it, validJwt } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe.todo("UDP domain", () => {
  const endpoint = `/v1/user`;
  const user = { name: "John Doe" };

  describe("/get user", () => {
    it("returns notification ID and user settings", async ({ cloudfront }) => {
      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${validJwt}` },
      });

      expect(response).toMatchObject({
        status: 200,
        body: {
          notificationId: expect.any(String) as string,
          preferences: {
            notifications: {
              consentStatus: expect.stringMatching(
                /^(unknown|consented|not_consented)$/,
              ) as string,
              updatedAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T[\d:T.-]+Z?$/,
              ) as string,
            },
          },
        },
      });
    });

    it("generation of notification ID is deterministic", async ({
      cloudfront,
    }) => {
      const request = cloudfront.client.get<{ notificationId: string }>(
        endpoint,
        {
          headers: { Authorization: `Bearer ${validJwt}` },
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
          notificationsConsented: "consented",
        },
        headers: { Authorization: `Bearer ${validJwt}` },
      });

      expect(response.status).toBe(201);
    });

    it("rejects invalid payloads", async ({ cloudfront }) => {
      const response = await cloudfront.client.patch(endpoint, {
        body: { notificationsConsented: "yes" },
        headers: { Authorization: `Bearer ${validJwt}` },
      });

      expect(response).toMatchObject({
        status: 400,
      });
    });
  });
});
