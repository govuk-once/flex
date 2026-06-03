import { it } from "@flex/testing";
import { userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get.private";

describe("GET /v1/identity/:service [private]", () => {
  const serviceName = "test-service";
  const serviceId = "test-service-id";
  const endpoint = `/identity/${serviceName}`;

  const identity = { serviceId, serviceName };

  it("returns 200 with identity when an identity link exists", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(200, identity);

    const result = await handler(
      sdk.event.get(endpoint, {
        userId,
        headers: { "User-Id": userId },
        params: { service: serviceName },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(identity);
  });

  it("returns 404 when an identity link does not exist", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(404);

    const result = await handler(
      sdk.event.get(endpoint, {
        userId,
        headers: { "User-Id": userId },
        params: { service: serviceName },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(404);
  });

  it("returns 502 when the UDP identity link integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(500);

    const result = await handler(
      sdk.event.get(endpoint, {
        userId,
        headers: { "User-Id": userId },
        params: { service: serviceName },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
