import { it, validJwt } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("Domain: Hello", () => {
  describe.todo("private API gateway permissions", () => {
    it("returns 403 when lambda without permission calls private hello-internal", async ({
      cloudfront,
    }) => {
      const response = await cloudfront.client.get("/v1/hello-call-internal", {
        headers: { Authorization: `Bearer ${validJwt}` },
      });

      expect(response).toMatchObject({
        status: 403,
        body: JSON.stringify({
          message: "Forbidden",
          status: 403,
        }),
      });
    });
  });

  it.for([
    { method: "GET", endpoint: "/hello-isolated" },
    { method: "GET", endpoint: "/hello-private" },
    { method: "GET", endpoint: "/hello-public" },
    { method: "GET", endpoint: "/v1/hello-call-internal" },
  ] as const)(
    "$method $endpoint rejects request at CloudFront when unauthenticated",
    async ({ endpoint }, { cloudfront }) => {
      const response = await cloudfront.client.get(endpoint);

      expect(response.headers.get("apigw-requestid")).toBeNull();
      expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(response).toMatchObject({
        status: 401,
        statusText: "Unauthorized",
        body: "Unauthorized: no authorization header provided",
      });
    },
  );

  it.for([
    { method: "GET", endpoint: "/hello-isolated" },
    { method: "GET", endpoint: "/hello-private" },
    { method: "GET", endpoint: "/hello-public" },
    { method: "GET", endpoint: "/v1/hello-call-internal" },
  ] as const)(
    "$method $endpoint rejects request at CloudFront when Bearer token is empty",
    async ({ endpoint }, { cloudfront }) => {
      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: "Bearer " },
      });

      expect(response.headers.get("apigw-requestid")).toBeNull();
      expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(response).toMatchObject({
        status: 401,
        statusText: "Unauthorized",
        body: "Unauthorized: authentication header invalid",
      });
    },
  );

  it.todo.for([
    {
      method: "GET",
      endpoint: "/hello-isolated",
      expectedBody: { message: "Hello isolated world!" },
    },
    {
      method: "GET",
      endpoint: "/hello-private",
      expectedBody: { message: "Hello private world!" },
    },
    {
      method: "GET",
      endpoint: "/hello-public",
      expectedBody: { message: "Hello public world!" },
    },
  ] as const)(
    "$method $endpoint returns a 200 and hello message",
    async ({ endpoint, expectedBody }, { cloudfront }) => {
      // TODO: Replace with valid test user token
      const token = "todo.valid.token";

      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.headers.get("apigw-requestid")).toBeDefined();
      expect(response).toMatchObject({
        status: 200,
        body: expectedBody,
      });
    },
  );
});
