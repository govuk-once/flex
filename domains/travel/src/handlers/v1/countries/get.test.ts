import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

const countries = {
  countries: [
    { countryId: "00a2d263-f4cc-4ed1-9ae8-ce5e73ce4d30", countryName: "Italy" },
    {
      countryId: "726afbd8-e8d1-4ef8-a3a8-9d0a4c467014",
      countryName: "Gibraltar",
    },
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
