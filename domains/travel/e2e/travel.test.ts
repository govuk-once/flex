import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

import { config as travelConfig } from "../domain.config";
import { CountriesResponseSchema } from "../src";

describe.runIf(isDomainDeployed(travelConfig))("Travel domain", () => {
  describe("/travel/v1/countries", () => {
    const endpoint = "/travel/v1/countries";

    describe.runIf(isRouteDeployed(travelConfig, "GET /v1/countries"))(
      "GET",
      () => {
        it("returns 200 with the published countries", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(endpoint, {
            headers: authHeader,
          });

          expect(result.status).toBe(200);

          const countries = CountriesResponseSchema.safeParse(result.body);

          expect(countries.success).toBe(true);

          // The gateway sorts the scan so the list is repeatable. An empty
          // list is a valid response, so this holds either way.
          const names = countries.data?.map(({ country }) => country) ?? [];

          expect(names).toStrictEqual(
            [...names].sort((a, b) => a.localeCompare(b)),
          );
        });

        it("returns 401 when no auth is provided", async ({ cloudfront }) => {
          const result = await cloudfront.client.get(endpoint);

          expect(result.status).toBe(401);
        });
      },
    );
  });
});
