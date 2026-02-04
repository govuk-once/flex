import { invalidJwt, it, validJwt } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("authentication", () => {
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
        headers: { Authorization: `Bearer ${invalidJwt}` },
      });

      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      expect(result).toMatchObject({
        status: 401,
        body: "Unauthorized: token invalid",
      });
    });
  });

  describe("Lambda authorizer", () => {
    it("allows request with a valid token", async ({ cloudfront }) => {
      const result = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${validJwt}` },
      });

      expect(result.headers.get("x-rejected-by")).toBeNull();
      expect(result).toEqual(
        expect.objectContaining({
          status: 200,
          body: JSON.stringify({ message: "Hello public world!" }),
        }),
      );
    });
  });
});
