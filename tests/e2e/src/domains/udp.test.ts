import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("UDP domain", () => {
  const ingressPath = "/1.0/app";
  const endpoint = `${ingressPath}/user`;
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
          notificationsConsented: true,
          analyticsConsented: true,
        },
        headers: { Authorization: `Bearer ${token}` },
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
      const token = "todo.valid.token";
      const response = await cloudfront.client.patch(endpoint, {
        body: { notificationsConsented: "yes", analyticsConsented: true },
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response).toMatchObject({
        status: 400,
        body: {
          message: "Invalid payload",
        },
      });
    });
  });
});
