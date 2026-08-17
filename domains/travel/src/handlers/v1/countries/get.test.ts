import { it } from "@flex/testing";
import { countries, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/countries", () => {
  const endpoint = "/v1/countries";

  it("returns 200 with the countries from the travel gateway", async ({
    http,
    sdk,
  }) => {
    http.gateway("travel").get("/countries").reply(200, countries);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(countries);
  });

  it("returns 200 with an empty list when no sources are published", async ({
    http,
    sdk,
  }) => {
    http.gateway("travel").get("/countries").reply(200, []);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([]);
  });

  it.for([
    { reason: "returns a client error", upstream: 404 },
    { reason: "fails unexpectedly", upstream: 500 },
  ])(
    "returns 502 when the travel gateway $reason",
    async ({ upstream }, { http, sdk }) => {
      http.gateway("travel").get("/countries").reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { auth: userId }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(502);
    },
  );
});
