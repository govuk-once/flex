import { SSMProvider } from "@aws-lambda-powertools/parameters/ssm";
import { viewDriverResponseSchema } from "@flex/dvla-domain";
import { beforeAll, describe, expect, inject } from "vitest";

import { it } from "../extend/it";

describe.sequential("DVLA domain", () => {
  const { JWT, ENVIRONMENT } = inject("e2eEnv");
  const authorization = { Authorization: `Bearer ${JWT.VALID}` };
  const ssmProvider = new SSMProvider();
  let linkingId: string;

  beforeAll(async () => {
    const rawLinkingId = await ssmProvider.get<string>(
      `/${ENVIRONMENT}/flex-param/dvla/test-user`,
    );
    if (!rawLinkingId)
      throw new Error(`Parameter not found for environment: ${ENVIRONMENT}`);

    linkingId = rawLinkingId;
  });

  describe("/dvla/v1/driving-licence", () => {
    const endpoint = "/dvla/v1/driving-licence";

    describe("GET", () => {
      // TODO: Failing test exceeds 30s timeout
      it.todo(
        "returns 200 and valid data when identity is linked",
        async ({ cloudfront, withIdentityLink }) => {
          await withIdentityLink("dvla", linkingId);

          const result = await cloudfront.client.get(endpoint, {
            headers: { ...authorization },
          });
          expect(result.status).toBe(200);

          const validation = viewDriverResponseSchema.safeParse(result.body);
          expect(validation.success).toBe(true);
        },
      );

      it("returns 404 when user is not linked", async ({
        cloudfront,
        withCleanIdentity,
      }) => {
        await withCleanIdentity("dvla");

        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });
        expect(result.status).toBe(404);
      });
    });
  });

  describe("/dvla/v1/test-notification", () => {
    const endpoint = "/dvla/v1/test-notification";

    describe("POST", () => {
      it("returns 202 when identity is linked and notification is sent", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink("dvla", linkingId);

        const result = await cloudfront.client.post(endpoint, {
          headers: { ...authorization },
          body: {},
        });

        expect(result.status).toBe(202);
      });

      it("returns 404 when user has no identity link", async ({
        cloudfront,
        withCleanIdentity,
      }) => {
        await withCleanIdentity("dvla");

        const result = await cloudfront.client.post(endpoint, {
          headers: { ...authorization },
          body: {},
        });

        expect(result.status).toBe(404);
      });
    });
  });
});
