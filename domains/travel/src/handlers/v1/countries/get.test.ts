import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

const countries = {
  countries: [
    { countryId: "239087657823923", countryName: "italy" },
    { countryId: "237689023786578", countryName: "gibraltar" },
  ],
};

describe("GET /v1/countries", () => {
  const endpoint = "/countries";

  it("returns 200 with a list of countries", async ({ http, sdk }) => {
    http.gateway("travel").get("/countries").reply(200, countries);

    const result = await handler(sdk.event.get(endpoint), sdk.context());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(countries);
  });
});
