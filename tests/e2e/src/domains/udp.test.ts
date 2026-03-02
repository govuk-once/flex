import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("UDP domain", () => {
  const { JWT } = inject("e2eEnv");
  const domainVersion = "v1";
  const endpoint = `/${domainVersion}/users`;

  describe.todo("user", () => {
    describe("when I create a user", () => {
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
  });

  describe.todo("notifications", () => {
    const notificationsEndpoint = `/${domainVersion}/users/notifications`;

    describe("when I update my notifications preferences", () => {
      it("returns user preferences updated successfully", async ({
        cloudfront,
      }) => {
        const response = await cloudfront.client.patch(notificationsEndpoint, {
          body: {
            consentStatus: "accepted",
          },
          headers: { Authorization: `Bearer ${JWT.VALID}` },
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          consentStatus: "accepted",
          notificationId: expect.any(String) as string,
        });
      });

      it("rejects invalid payloads", async ({ cloudfront }) => {
        const response = await cloudfront.client.patch(notificationsEndpoint, {
          body: {
            consentStatus: "yes",
          },
          headers: { Authorization: `Bearer ${JWT.VALID}` },
        });

        expect(response).toMatchObject({
          status: 400,
        });
      });
    });
  });
});
