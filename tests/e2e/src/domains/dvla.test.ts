import { SSMProvider } from "@aws-lambda-powertools/parameters/ssm";
import { viewDriverResponseSchema } from "@flex/dvla-domain";
import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("DVLA domain", () => {
  const { JWT, ENVIRONMENT } = inject("e2eEnv");
  const authorization = { Authorization: `Bearer ${JWT.VALID}` };

  const ssmProvider = new SSMProvider();

  describe("/dvla/v1/driving-licence", () => {
    const endpoint = "/dvla/v1/driving-licence";

    describe("GET", () => {
      it("rejects unauthenticated requests", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint);

        expect(result.status).toBe(401);

        expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      });

      it("returns 200 and valid data when identity is linked", async ({
        cloudfront,
      }) => {
        const linkingId = await ssmProvider.get<string>(
          `/${ENVIRONMENT}/flex-param/dvla/test-user`,
        );

        if (!linkingId) {
          throw new Error(
            `Parameter not found for environment: ${ENVIRONMENT}`,
          );
        }

        const postLinkingId = `/udp/v1/identity/dvla/${linkingId}`;
        const setupResult = await cloudfront.client.post(postLinkingId, {
          headers: { ...authorization },
        });
        expect([201, 204]).toContain(setupResult.status);

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
