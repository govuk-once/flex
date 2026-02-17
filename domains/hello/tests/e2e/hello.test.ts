import { it, validJwt } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe.todo("Domain: Hello", () => {
  it.for([
    {
      method: "GET",
      endpoint: "/v1/hello-isolated",
      expectedBody: { message: "Hello isolated world!" },
    },
    {
      method: "GET",
      endpoint: "/v1/hello-private",
      expectedBody: { message: "Hello private world!" },
    },
    {
      method: "GET",
      endpoint: "/v1/hello-public",
      expectedBody: { message: "Hello public world!" },
    },
  ] as const)(
    "$method $endpoint returns a 200 and hello message",
    async ({ endpoint, expectedBody }, { cloudfront }) => {
      // TODO: Replace with valid test user token
      const token = validJwt;

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
