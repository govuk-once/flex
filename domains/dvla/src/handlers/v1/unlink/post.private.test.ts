import { it, token } from "@flex/testing";
import {
  serviceIdentityLink,
  session,
  unlinkResult,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post.private";

describe("POST /v1/unlink [private]", () => {
  const endpoint = "/unlink";

  it("returns 200 with success when DVLA unlinking succeeds", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/identity/dvla", { headers: { "User-Id": userId } })
      .reply(200, serviceIdentityLink);
    http.gateway("dvla").get("/authenticate").reply(200, session);
    http
      .gateway("dvla")
      .post(`/unlink-user/${serviceIdentityLink.serviceId}`, {
        headers: { auth: token },
      })
      .reply(200, unlinkResult);

    const result = await handler(
      sdk.event.post(endpoint, { headers: { "User-Id": userId } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(unlinkResult);
  });

  it("returns 400 when the User-Id header is missing", async ({ sdk }) => {
    const result = await handler(sdk.event.post(endpoint, {}), sdk.context());

    expect(result.statusCode).toBe(400);
  });

  it.for([
    { reason: "cannot find the link", upstream: 404, expected: 404 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UDP get linking ID integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, { headers: { "User-Id": userId } }),
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
        sdk.event.post(endpoint, { headers: { "User-Id": userId } }),
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
    "returns $expected when the DVLA unlink-user integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(200, serviceIdentityLink);
      http.gateway("dvla").get("/authenticate").reply(200, session);
      http
        .gateway("dvla")
        .post(`/unlink-user/${serviceIdentityLink.serviceId}`, {
          headers: { auth: token },
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, { headers: { "User-Id": userId } }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
