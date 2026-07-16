import { it } from "@flex/testing";
import { countries } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/countries", () => {
  const endpoint = "/countries";

  it("returns 200 with a list of countries", async ({ http, sdk }) => {
    http.gateway("travel").get("/countries").reply(200, countries);

    const result = await handler(sdk.event.get(endpoint), sdk.context());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(countries);
  });

  it.for([
    { reason: "Fails unexpectedly", upstream: 500, expected: 502 },
    { reason: "is a bad gateway", upstream: 502, expected: 502 },
  ])(
    "returns $expected when the travel gateway $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http.gateway("travel").get("/countries").reply(upstream);

      const result = await handler(sdk.event.get(endpoint), sdk.context());

      expect(result.statusCode).toBe(expected);
    },
  );
});
