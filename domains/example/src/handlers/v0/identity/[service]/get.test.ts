import { it } from "@flex/testing";
import { serviceIdentityLink, serviceName, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/identity/:service", () => {
  const endpoint = `/identity/${serviceName}`;

  it("returns 200 with linked true when the identity exists", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(200, serviceIdentityLink);

    const result = await handler(
      sdk.event.get(endpoint, { userId, params: { service: serviceName } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({ linked: true });
  });

  it("returns 200 with linked false when the identity does not exist", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(404);

    const result = await handler(
      sdk.event.get(endpoint, { userId, params: { service: serviceName } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({ linked: false });
  });

  it("returns 502 when upstream fails", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(500);

    const result = await handler(
      sdk.event.get(endpoint, { userId, params: { service: serviceName } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
