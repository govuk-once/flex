import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("Domain: Hello v1", () => {
  const { JWT } = inject("e2eEnv");

  it.for([
    { method: "GET", endpoint: `hello/v1/hello-isolated` },
    { method: "GET", endpoint: `hello/v1/hello-private` },
    { method: "GET", endpoint: `hello/v1/hello-public` },
  ] as const)(
    "$method $endpoint rejects request at CloudFront when unauthenticated",
    async ({ endpoint }, { cloudfront }) => {
      const response = await cloudfront.client.get(endpoint);

      expect(response.headers.get("apigw-requestid")).toBeNull();
      expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(response).toMatchObject({
        status: 401,
        statusText: "Unauthorized",
        body: { message: "Unauthorized" },
      });
    },
  );

  it.for([
    { method: "GET", endpoint: `hello/v1/hello-isolated` },
    { method: "GET", endpoint: `hello/v1/hello-private` },
    { method: "GET", endpoint: `hello/v1/hello-public` },
    { method: "GET", endpoint: `hello/v1/hello-call-internal` },
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
        body: { message: "Unauthorized" },
      });
    },
  );

  it.for([
    {
      method: "GET",
      endpoint: `hello/v1/hello-isolated`,
      expectedBody: { message: "Hello isolated world!" },
    },
    {
      method: "GET",
      endpoint: `hello/v1/hello-private`,
      expectedBody: { message: "Hello private world!" },
    },
    {
      method: "GET",
      endpoint: `hello/v1/hello-public`,
      expectedBody: { message: "Hello public world!" },
    },
  ] as const)(
    "$method $endpoint returns a 200 and hello message",
    async ({ endpoint, expectedBody }, { cloudfront }) => {
      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      });

      expect(response.headers.get("apigw-requestid")).toBeDefined();
      expect(response).toMatchObject({
        status: 200,
        body: expectedBody,
      });
    },
  );
});
