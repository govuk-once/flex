import { it, validJwt } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("authentication - API GW", () => {
  const endpoint = `/v1/hello-public`;

  describe.skip("Lambda authorizer", () => {
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
