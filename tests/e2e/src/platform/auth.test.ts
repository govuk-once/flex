import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

/**
 * E2E test for the API Gateway JWT authorizer
 *
 * This test verifies that the API Gateway JWT authorizer correctly rejects
 * requests without a valid JWT token.
 */
describe("authentication", () => {
  describe("fail-fast", () => {
    it("rejects request to cloudfront distribution when unauthenticated", async ({
      cloudfront,
    }) => {
      const response = await cloudfront.client.get("/hello-public");

      expect(response.headers.get("apigw-requestid")).toBeNull();
      expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(response).toMatchObject({
        status: 401,
        statusText: "Unauthorized",
        body: "Unauthorized: no authorization header provided",
      });
    });

    it("rejects request to cloudfront distribution with empty Bearer token", async ({
      cloudfront,
    }) => {
      const response = await cloudfront.client.get("/hello-public", {
        headers: { Authorization: `Bearer ` },
      });

      expect(response.headers.get("apigw-requestid")).toBeNull();
      expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(response).toMatchObject({
        status: 401,
        statusText: "Unauthorized",
        body: "Unauthorized: authentication header invalid",
      });
    });

    it("rejects request with invalid Bearer token", async ({ cloudfront }) => {
      const response = await cloudfront.client.get("/hello-public", {
        headers: { Authorization: "Basic invalidbearertoken" },
      });

      expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(response.headers.get("apigw-requestid")).toBeDefined();
      expect(response).toMatchObject({
        status: 401,
        statusText: "Unauthorized",
        body: "Unauthorized: authentication header invalid",
      });
    });
  });

  describe("authorizer", () => {
    it.todo(
      "allows request to /hello-public endpoint with valid token",
      async ({ cloudfront }) => {
        // TODO: Replace with valid test user token
        const token = "todo.valid.token";

        const response = await cloudfront.client.get("/hello-public", {
          headers: { Authorization: `Bearer ${token}` },
        });

        expect(response.headers.get("x-rejected-by")).toBeNull();
        expect(response).toMatchObject({
          status: 200,
          body: { message: "Hello public world!" },
        });
      },
    );

    it.todo(
      "rejects request to /hello-public endpoint with expired token",
      async ({ cloudfront }) => {
        // TODO: Replace with expired test user token
        const token = "todo.expired.token";

        const response = await cloudfront.client.get("/hello-public", {
          headers: { Authorization: `Bearer ${token}` },
        });

        expect(response.status).toBe(403);
      },
    );
  });
});
