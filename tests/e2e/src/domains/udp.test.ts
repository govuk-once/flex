import { it, validJwt, validJwtUsername } from "@flex/testing/e2e";
import { beforeAll, describe, expect } from "vitest";

describe("UDP domain", () => {
  const endpoint = `/v1/user`;
  const user = { name: "John Doe" };

  it("rejects request at CloudFront when unauthenticated", async ({
    cloudfront,
  }) => {
    const response = await cloudfront.client.post(endpoint, {
      body: user,
    });

    expect(response.headers.get("apigw-requestid")).toBeNull();
    expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
    expect(response).toMatchObject({
      status: 401,
      statusText: "Unauthorized",
      body: "Unauthorized: no authorization header provided",
    });
  });

  it("rejects request at CloudFront when Bearer token is empty", async ({
    cloudfront,
  }) => {
    const response = await cloudfront.client.post(endpoint, {
      body: user,
      headers: { Authorization: "Bearer " },
    });

    expect(response.headers.get("apigw-requestid")).toBeNull();
    expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
    expect(response).toMatchObject({
      status: 401,
      statusText: "Unauthorized",
      body: "Unauthorized: authentication header invalid",
    });
  });

  describe("/get user", () => {
    it("returns a 200 and notification ID", async ({ cloudfront }) => {
      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${validJwt}` },
      });

      expect(response).toMatchObject({
        status: 200,
        body: {
          notificationId: expect.any(String) as string,
          preferences: {
            notifications: {
              consentStatus: "unknown",
              updatedAt: expect.any(String) as string,
            },
            analytics: {
              consentStatus: "unknown",
              updatedAt: expect.any(String) as string,
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

    it("returns a 200 and user settings", async ({ cloudfront }) => {
      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${validJwt}` },
      });
      expect(response).toMatchObject({
        status: 200,
        body: {
          notificationId: expect.any(String),
          preferences: {
            notifications: {
              consentStatus: "unknown",
              updatedAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T[\d:T.-]+Z?$/,
              ),
            },
            analytics: {
              consentStatus: "unknown",
              updatedAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T[\d:T.-]+Z?$/,
              ),
            },
          },
        },
      });
    });
  });

  describe("/patch user", () => {
    it("returns user preferences updated successfully", async ({
      cloudfront,
    }) => {
      const response = await cloudfront.client.patch(endpoint, {
        body: {
          notificationsConsented: true,
          analyticsConsented: true,
        },
        headers: { Authorization: `Bearer ${validJwt}` },
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
        headers: { Authorization: `Bearer ${validJwt}` },
      });

      expect(response).toMatchObject({
        status: 400,
      });
    });
  });
});
