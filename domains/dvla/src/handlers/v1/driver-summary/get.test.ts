import { it, token } from "@flex/testing";
import {
  driverSummary,
  linkingId,
  serviceIdentityLink,
  session,
  userId,
  withLinkingId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/driver-summary", () => {
  const endpoint = "/driver-summary";

  it("returns 200 with the driver summary", async ({ http, sdk }) => {
    http
      .domain("udp")
      .get("/identity/dvla", { headers: { "User-Id": userId } })
      .reply(200, serviceIdentityLink);
    http.gateway("dvla").get("/authenticate").reply(200, session);
    http
      .gateway("dvla")
      .get(`/driver-summary/${linkingId}`, { headers: { auth: token } })
      .reply(200, withLinkingId(driverSummary));

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(driverSummary);
  });

  it.for([
    { reason: "cannot find the link", upstream: 404, expected: 404 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UDP get identity link integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http.gateway("dvla").get("/authenticate").reply(200, session);

      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { userId }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the DVLA authenticate integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(200, serviceIdentityLink);

      http.gateway("dvla").get("/authenticate").reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { userId }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([
    { reason: "returns a bad request", upstream: 400, expected: 400 },
    { reason: "cannot find the link", upstream: 404, expected: 404 },
    { reason: "is rate limited", upstream: 429, expected: 429 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the DVLA get driver summary integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(200, serviceIdentityLink);
      http.gateway("dvla").get("/authenticate").reply(200, session);

      http
        .gateway("dvla")
        .get(`/driver-summary/${linkingId}`, { headers: { auth: token } })
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { userId }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
