import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import {
  CountriesResponseSchema,
  EventsResponseSchema,
} from "@flex/travel-service-gateway";
import { describe, expect } from "vitest";

import { config as travelConfig } from "../domain.config";

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

  describe("/travel/v1/events", () => {
    const endpoint = "/travel/v1/events";

    describe.runIf(isRouteDeployed(travelConfig, "GET /v1/events"))(
      "GET",
      () => {
        it("returns 200 with the recent travel alerts", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(endpoint, {
            headers: authHeader,
            params: { namespace: "travel", group: "france" },
          });

          expect(result.status).toBe(200);

          const events = EventsResponseSchema.safeParse(result.body);

          expect(events.success).toBe(true);
        });

        it.for<{
          reason: string;
          params: Record<string, string>;
          expectedStatus: number;
          withAuth: boolean;
        }>([
          {
            reason: "the namespace is missing",
            params: { group: "france" },
            expectedStatus: 400,
            withAuth: true,
          },
          {
            reason: "the group is missing",
            params: { namespace: "travel" },
            expectedStatus: 400,
            withAuth: true,
          },
          {
            reason: 'the namespace is not "travel"',
            params: { namespace: "other namespace", group: "france" },
            expectedStatus: 400,
            withAuth: true,
          },
          {
            reason: "the auth header is missing",
            params: { namespace: "travel", group: "france" },
            expectedStatus: 401,
            withAuth: false,
          },
        ])(
          "returns $expectedStatus when $reason",
          async (
            { params, expectedStatus, withAuth },
            { cloudfront, authHeader },
          ) => {
            const result = await cloudfront.client.get(endpoint, {
              headers: withAuth ? authHeader : undefined,
              params,
            });

            expect(result.status).toBe(expectedStatus);
          },
        );
      },
    );
  });
});
