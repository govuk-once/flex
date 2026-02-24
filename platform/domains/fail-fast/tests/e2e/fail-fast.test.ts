import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("authentication", () => {
  const { INVALID_JWT } = inject("e2eEnv");
  const endpoint = `/v1/hello-public`;

  describe("CloudFront fail-fast", () => {
    it("rejects request where authorization header is missing", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.get(endpoint);

      expect(result.headers.get("apigw-requestid")).toBeNull();
      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(result).toMatchObject({
        status: 401,
        body: "Unauthorized: no authorization header provided",
      });
    });

    it("rejects request where Bearer token is empty", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ` },
      });

      expect(result.headers.get("apigw-requestid")).toBeNull();
      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(result).toMatchObject({
        status: 401,
        body: "Unauthorized: authentication header invalid",
      });
    });

    it("rejects request where authorization is not Bearer", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Basic credentials` },
      });

      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(result).toMatchObject({
        status: 401,
        body: "Unauthorized: authentication header invalid",
      });
    });

    it("rejects request where Bearer token is invalid", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${INVALID_JWT}` },
      });

      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(result).toMatchObject({
        status: 401,
        body: "Unauthorized: token invalid",
      });
    });
  });
});
