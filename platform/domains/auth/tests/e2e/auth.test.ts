import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("authentication - API GW", () => {
  const endpoint = `/v1/hello-public`;

  describe("Lambda authorizer", () => {
    it("allows request with a valid token", async ({ cloudfront }) => {
      const { VALID_JWT } = inject("e2eEnv");
      const result = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${VALID_JWT}` },
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
