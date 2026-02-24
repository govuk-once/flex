import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("Domain: Hello", () => {
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
      const { VALID_JWT } = inject("e2eEnv");

      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${VALID_JWT}` },
      });

      expect(response.headers.get("apigw-requestid")).toBeDefined();
      expect(response).toMatchObject({
        status: 200,
        body: JSON.stringify(expectedBody),
      });
    },
  );
});
