import { it, token } from "@flex/testing";
import {
  createSingleShareCode,
  linkingId,
  serviceIdentityLink,
  session,
  tokenId,
  userId,
  withLinkingId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v1/share-code/:id/cancel", () => {
  const endpoint = `/share-code/${tokenId}/cancel`;

  it("returns 200 with the cancelled single share code", async ({
    http,
    sdk,
  }) => {
    const cancelledSingleShareCode = createSingleShareCode({
      state: "cancelled",
      token: "B2CDFGHJ",
      documentReference: "REF12345",
      expiry: "2026-05-22T10:00:00Z",
      status: "inactive",
      cancelled: "2026-05-07T14:00:00Z",
    });

    http
      .domain("udp")
      .get("/identity/dvla", { headers: { "User-Id": userId } })
      .reply(200, serviceIdentityLink);
    http.gateway("dvla").get("/authenticate").reply(200, session);
    http
      .gateway("dvla")
      .post(`/share-code/${tokenId}/cancel`, {
        headers: { auth: token },
        query: { linkingId },
      })
      .reply(200, withLinkingId(cancelledSingleShareCode));

    const result = await handler(
      sdk.event.post(endpoint, { userId, params: { id: tokenId } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(cancelledSingleShareCode);
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
        sdk.event.post(endpoint, { userId, params: { id: tokenId } }),
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
        sdk.event.post(endpoint, { userId, params: { id: tokenId } }),
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
    "returns $expected when the DVLA cancel share code integration integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(200, serviceIdentityLink);
      http.gateway("dvla").get("/authenticate").reply(200, session);

      http
        .gateway("dvla")
        .post(`/share-code/${tokenId}/cancel`, {
          headers: { auth: token },
          query: { linkingId },
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, { userId, params: { id: tokenId } }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
