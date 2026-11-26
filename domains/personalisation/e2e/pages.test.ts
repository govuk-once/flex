import { config } from "@domain";
import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe.runIf(isDomainDeployed(config))(
  "Personalisation domain: pages",
  () => {
    describe("/personalisation/v1/activity/pages", () => {
      const endpoint = "/personalisation/v1/activity/pages";

      describe.runIf(isRouteDeployed(config, "POST /v1/activity/pages"))(
        "POST",
        () => {
          it("returns 204 when the page is stored", async ({
            cloudfront,
            udpUser: _,
            authHeader,
          }) => {
            const page = {
              id: `e2e-${String(Date.now())}`,
              title: "E2E page",
              date: Math.floor(Date.now() / 1000),
              url: "https://www.gov.uk/e2e",
            };

            const postResult = await cloudfront.client.post(endpoint, {
              headers: authHeader,
              body: page,
            });

            expect(postResult.status).toBe(204);
          });

          it.for([
            { body: {}, reason: "is empty" },
            {
              body: { id: "x", title: "t", date: 1, url: "not-a-url" },
              reason: "has an invalid url",
            },
            {
              body: { id: "x", title: "t", date: 1.5, url: "https://gov.uk" },
              reason: "has a non-integer date",
            },
          ])(
            "rejects request when body $reason",
            async ({ body }, { cloudfront, authHeader }) => {
              const result = await cloudfront.client.post(endpoint, {
                headers: authHeader,
                body,
              });

              expect(result.status).toBe(400);
            },
          );

          it("returns 401 when no auth header is provided", async ({
            cloudfront,
          }) => {
            const result = await cloudfront.client.post(endpoint, {
              body: {
                id: "x",
                title: "t",
                date: 1,
                url: "https://www.gov.uk",
              },
            });

            expect(result.status).toBe(401);
          });
        },
      );
    });
  },
);
