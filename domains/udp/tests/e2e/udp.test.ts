import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("UDP domain", () => {
  const ingressPath = "/app";
  const domainVersion = "v1";
  const endpoint = `${ingressPath}/${domainVersion}/user`;
  const { INVALID_JWT, VALID_JWT } = inject("e2eEnv");

  describe.todo("/get user", () => {
    it("returns a 200 and notification ID", async ({ cloudfront }) => {
      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${VALID_JWT}` },
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
          headers: { Authorization: `Bearer ${VALID_JWT}` },
        },
      );

      const [response1, response2] = await Promise.all([request, request]);

      expect(response1.body?.notificationId).toBe(
        response2.body?.notificationId,
      );
    });
  });

  describe.todo("/patch user", () => {
    // TODO: pending valid tokens
    it("returns user preferences updated successfully", async ({
      cloudfront,
    }) => {
      const response = await cloudfront.client.patch(endpoint, {
        body: {
          notificationsConsented: true,
          analyticsConsented: true,
        },
        headers: { Authorization: `Bearer ${VALID_JWT}` },
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        preferences: {
          notificationsConsented: true,
          analyticsConsented: true,
          updatedAt: expect.any(String) as string,
        },
      });
    });

    it("rejects invalid payloads", async ({ cloudfront }) => {
      const response = await cloudfront.client.patch(endpoint, {
        body: { notificationsConsented: "yes" },
        headers: { Authorization: `Bearer ${INVALID_JWT}` },
      });

      expect(response).toMatchObject({
        status: 400,
      });
    });
  });
});
