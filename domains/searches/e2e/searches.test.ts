import { config } from "@domain";
import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { SearchTerm } from "@schemas/search";
import { describe, expect } from "vitest";

describe.runIf(isDomainDeployed(config))("Searches domain", () => {
  describe("/searches/v1/activity/searches", () => {
    const endpoint = "/searches/v1/activity/searches";

    describe.runIf(isRouteDeployed(config, "PATCH /v1/activity/searches"))(
      "PATCH",
      () => {
        const searchTerm: SearchTerm = {
          term: "A New Search 11",
          timestamp: "2026-11-04T13:45:00Z",
        };

        it("returns 201 with updated user searches", async ({
          cloudfront,
          udpUser: _,
          authHeader,
        }) => {
          const result = await cloudfront.client.patch(endpoint, {
            headers: authHeader,
            body: searchTerm,
          });

          expect(result.status).toBe(201);
          expect(result.body).toBeUndefined();
        });

        it("returns 401 when no auth is provided", async ({ cloudfront }) => {
          const result = await cloudfront.client.patch(endpoint, {
            body: searchTerm,
          });

          expect(result.status).toBe(401);
        });
      },
    );
  });
});
