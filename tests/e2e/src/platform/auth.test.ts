import { describe, expect, it } from "vitest";

import { e2eEnv } from "../setup";

/**
 * E2E test for the API Gateway JWT authorizer
 *
 * This test verifies that the API Gateway JWT authorizer correctly rejects
 * requests without a valid JWT token.
 */
describe("authentication", () => {
  const ingressUrl = e2eEnv.CLOUDFRONT_DISTRIBUTION_URL;

  describe("fail-fast", () => {
    it("rejects request to cloudfront distribution without a structurally valid JWT token", async () => {
      const response = await fetch(`${ingressUrl}/hello-public`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseText = await response.text();

      expect(response.status).toBe(401);
      expect(responseText).toEqual(
        "Unauthorized: no authorization header provided",
      );
      expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
    });

    it("rejects request to cloudfront distribution with a structurally invalid JWT token", async () => {
      const response = await fetch(`${ingressUrl}/hello-public`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer `,
        },
      });
      const responseText = await response.text();

      expect(response.status).toBe(401);
      expect(responseText).toEqual("Unauthorized: structural check failed");
      expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
    });
  });

  describe("authorizer", () => {
    it("allows request to /hello-public endpoint with valid authorization header", async () => {
      const url = `${ingressUrl}/hello-public`;
      const token = "eyJ2";

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();

      expect(response.status).toBe(200);
      expect(responseText).toEqual(
        JSON.stringify({ message: "Hello public world!" }),
      );
    });
  });
});
