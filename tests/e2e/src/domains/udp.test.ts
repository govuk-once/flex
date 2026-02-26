import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("UDP domain", () => {
  const domainVersion = "v1";
  const endpoint = `/${domainVersion}/user`;

  describe.todo("/get user", () => {
    // TODO: Replace with valid test user token
    it("returns a 200 and notification ID", async ({ cloudfront }) => {
      const token = "todo.valid.token";
      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
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
      const token = "todo.valid.token";
      const request = cloudfront.client.get<{ notificationId: string }>(
        endpoint,
        {
          headers: { Authorization: `Bearer ${token}` },
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
      const token = "todo.valid.token";
      const response = await cloudfront.client.patch(endpoint, {
        body: {
          preferences: {
            notifications: {
              consentStatus: "accepted",
            },
          },
        },
        headers: { Authorization: `Bearer ${token}` },
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
      const token = "todo.valid.token";
      const response = await cloudfront.client.patch(endpoint, {
        body: {
          preferences: {
            notifications: {
              consentStatus: "yes",
            },
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response).toMatchObject({
        status: 400,
      });
    });
  });
});
