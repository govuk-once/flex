import { it, token } from "@flex/testing";
import {
  customerSummary,
  licence,
  linkingId,
  productKey,
  serviceIdentityLink,
  session,
  userId,
  withLinkingId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/driving-licence", () => {
  const endpoint = "/driving-licence";

  it("returns 200 with the driving licence", async ({ http, sdk }) => {
    http
      .domain("udp")
      .get("/identity/dvla", { headers: { "User-Id": userId } })
      .reply(200, serviceIdentityLink);
    http.gateway("dvla").get("/authenticate").reply(200, session);
    http
      .gateway("dvla")
      .get(`/customer-summary/${linkingId}`, { headers: { auth: token } })
      .reply(200, customerSummary);
    http
      .gateway("dvla")
      .get(`/licence/${productKey}`, { headers: { auth: token } })
      .reply(200, licence);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(licence);
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
    "returns $expected when the DVLA customer summary integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(200, serviceIdentityLink);
      http.gateway("dvla").get("/authenticate").reply(200, session);

      http
        .gateway("dvla")
        .get(`/customer-summary/${linkingId}`)
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { userId }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([
    {
      reason: 'the "customer" record is incomplete',
      response: withLinkingId({ customerResponse: { customer: {} } }),
    },
    {
      reason: "no driving licence product is found",
      response: withLinkingId({
        customerResponse: { customer: {}, products: [] },
      }),
    },
  ])("returns 422 when $reason", async ({ response }, { http, sdk }) => {
    http
      .domain("udp")
      .get("/identity/dvla", { headers: { "User-Id": userId } })
      .reply(200, serviceIdentityLink);
    http.gateway("dvla").get("/authenticate").reply(200, session);
    http
      .gateway("dvla")
      .get(`/customer-summary/${linkingId}`)
      .reply(200, response);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(422);
    expect(result.body).toBe("");
  });

  it.for([
    { reason: "returns a bad request", upstream: 400, expected: 400 },
    { reason: "cannot find the licence", upstream: 404, expected: 404 },
    { reason: "is rate limited", upstream: 429, expected: 429 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the DVLA retrieve licence integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(200, serviceIdentityLink);
      http.gateway("dvla").get("/authenticate").reply(200, session);
      http
        .gateway("dvla")
        .get(`/customer-summary/${linkingId}`, { headers: { auth: token } })
        .reply(200, customerSummary);

      http
        .gateway("dvla")
        .get(`/licence/${productKey}`, { headers: { auth: token } })
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
