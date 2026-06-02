import { it, token } from "@flex/testing";
import { session, unlinkResult, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post.private";

describe("POST /v1/unlink [private]", () => {
  const endpoint = "/unlink";

  it("returns 200 with success when DVLA unlinking succeeds", async ({
    http,
    sdk,
  }) => {
    http.gateway("dvla").get("/authenticate").reply(200, session);
    http
      .gateway("dvla")
      .post(`/unlink-user/${userId}`, { headers: { auth: token } })
      .reply(200, unlinkResult);

    const result = await handler(
      sdk.event.post(endpoint, { params: { id: userId } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(unlinkResult);
  });

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the DVLA authenticate integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http.gateway("dvla").get("/authenticate").reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, { params: { id: userId } }),
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
    "returns $expected when the DVLA post share code integration integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http.gateway("dvla").get("/authenticate").reply(200, session);

      http
        .gateway("dvla")
        .post(`/unlink-user/${userId}`, { headers: { auth: token } })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, { params: { id: userId } }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
