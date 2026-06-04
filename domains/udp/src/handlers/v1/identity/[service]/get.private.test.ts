import { it } from "@flex/testing";
import { serviceIdentityLink, serviceName, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get.private";

describe("GET /v1/identity/:service [private]", () => {
  const endpoint = `/identity/${serviceName}`;

  it("returns 200 with identity when the service identity link exists", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(200, serviceIdentityLink);

    const result = await handler(
      sdk.event.get(endpoint, {
        userId,
        headers: { "User-Id": userId },
        params: { service: serviceName },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(serviceIdentityLink);
  });

  it('returns 400 when the "User-Id" header is missing', async ({ sdk }) => {
    const result = await handler(
      sdk.event.get(endpoint, {
        userId,
        params: { service: serviceName },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toStrictEqual({
      headers: ["User-Id"],
      message: "Missing headers: User-Id",
    });
  });

  it.for([
    {
      reason: "cannot find the service identity link",
      upstream: 404,
      expected: 404,
    },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UDP get identity link integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, {
          userId,
          headers: { "User-Id": userId },
          params: { service: serviceName },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
