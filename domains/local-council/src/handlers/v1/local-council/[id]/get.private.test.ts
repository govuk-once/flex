import { it } from "@flex/testing";
import { localAuthority, localCouncilId, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get.private";

describe("GET /v1/local-council/:id [private]", () => {
  const endpoint = `/local-council/${localCouncilId}`;

  it("returns 200 with the local authority data", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get(`/local-council/${localCouncilId}`)
      .reply(200, localAuthority);

    const result = await handler(
      sdk.event.get(endpoint, { userId, params: { id: localCouncilId } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(localAuthority);
  });

  it.for([
    { reason: "cannot find the local authority", upstream: 404, expected: 404 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UDP get local authority integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .gateway("udp")
        .get(`/local-council/${localCouncilId}`)
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { userId, params: { id: localCouncilId } }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
