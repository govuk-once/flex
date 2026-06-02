import { it } from "@flex/testing";
import { registrationNumber, userId, vehicle } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/vehicle-enquiry/:reg", () => {
  const endpoint = `/vehicle-enquiry/${registrationNumber}`;

  it("returns 200 with the vehicle details", async ({ http, sdk }) => {
    http
      .gateway("dvla")
      .get(`/vehicle-enquiry/${registrationNumber}`)
      .reply(200, vehicle);

    const result = await handler(
      sdk.event.get(endpoint, { userId, params: { reg: registrationNumber } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(vehicle);
  });

  it.for([
    { reason: "returns a bad request", upstream: 400, expected: 400 },
    { reason: "cannot find the link", upstream: 404, expected: 404 },
    { reason: "is rate limited", upstream: 429, expected: 429 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the DVLA post share code integration integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .gateway("dvla")
        .get(`/vehicle-enquiry/${registrationNumber}`)
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, {
          userId,
          params: { reg: registrationNumber },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
