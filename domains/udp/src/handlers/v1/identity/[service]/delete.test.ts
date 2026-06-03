import { it } from "@flex/testing";
import { userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./delete";

describe("DELETE /v1/identity/:service", () => {
  const serviceName = "test-service";
  const serviceId = "test-service-id";
  const endpoint = `/identity/${serviceName}`;

  const identity = { serviceId, serviceName };

  it("returns 204 when an identity unlink succeeds", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(200, identity);
    http
      .gateway("udp")
      .delete(`/identity/${identity.serviceName}/${identity.serviceId}`)
      .reply(204);

    const result = await handler(
      sdk.event.delete(endpoint, { userId, params: { service: serviceName } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
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
      sdk.event.delete(endpoint, { userId, params: { service: serviceName } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(404);
    expect(result.body).toBe("");
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
      sdk.event.delete(endpoint, { userId, params: { service: serviceName } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });

  it("returns 502 when the UDP identity unlink integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(200, identity);
    http
      .gateway("udp")
      .delete(`/identity/${identity.serviceName}/${identity.serviceId}`)
      .reply(500);

    const result = await handler(
      sdk.event.delete(endpoint, { userId, params: { service: serviceName } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });
});
