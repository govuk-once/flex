import { it } from "@flex/testing";
import { registrationNumber, session, vehicleMot } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/vehicle/mot/:reg", () => {
  const endpoint = `/vehicle/mot/${registrationNumber}`;

  it("returns 200 with the MOT history", async ({ http, sdk }) => {
    http.gateway("dvsa").get("/authenticate").reply(200, session);

    http
      .gateway("dvsa")
      .get(`/vehicle/mot/${registrationNumber}`)
      .reply(200, vehicleMot);

    const result = await handler(
      sdk.event.get(endpoint, {
        params: { reg: registrationNumber },
        headers: { auth: "jwt" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(vehicleMot);
  });

  it.for([
    {
      reason: "returns a bad request",
      upstream: 400,
      expected: 400,
    },
    {
      reason: "cannot find the vehicle",
      upstream: 404,
      expected: 404,
    },
    {
      reason: "is rate limited",
      upstream: 429,
      expected: 429,
    },
    {
      reason: "fails unexpectedly",
      upstream: 500,
      expected: 502,
    },
  ])(
    "returns $expected when the DVSA MOT integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http.gateway("dvsa").get("/authenticate").reply(200, session);

      http
        .gateway("dvsa")
        .get(`/vehicle/mot/${registrationNumber}`)
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, {
          params: { reg: registrationNumber },
          headers: { auth: "jwt" },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
    },
  );

  it("returns 502 when DVSA authentication fails", async ({ http, sdk }) => {
    http.gateway("dvsa").get("/authenticate").reply(500);

    const result = await handler(
      sdk.event.get(endpoint, {
        params: { reg: registrationNumber },
        headers: { auth: "jwt" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
