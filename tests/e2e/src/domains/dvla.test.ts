import { viewDriverResponseSchema } from "@flex/dvla-domain";
import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("DVLA domain", () => {
  const { JWT } = inject("e2eEnv");

  const authorization = { Authorization: `Bearer ${JWT.VALID}` };

  describe("/dvla/v1/driving-licence", () => {
    const endpoint = "/dvla/v1/driving-licence";

    describe("GET", () => {
      it("rejects unauthenticated requests", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint);

        expect(result.status).toBe(401);
        expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      });

      it("returns 200 and valid body for digital drivers licence data", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);
        const validation = viewDriverResponseSchema.safeParse(result.body);
        expect(validation.success).toBe(true);
      });
    });
  });
});
