import { it } from "@flex/testing";
import { userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v1/identity/:service/:id", () => {
  const serviceName = "test-service";
  const serviceId = "test-service-id";
  const existingServiceId = "test-existing-service-id";
  const endpoint = `/identity/${serviceName}/${serviceId}`;

  const identity = { appId: userId };
  const linked = { serviceId, serviceName };

  it("returns 201 when an identity link succeeds", async ({ http, sdk }) => {
    http.gateway("udp").get(`/identity/${serviceName}`).reply(404);
    http
      .gateway("udp")
      .post(`/identity/${serviceName}/${serviceId}`, { body: identity })
      .reply(201);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        params: { service: serviceName, id: serviceId },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 204 when an identity link already exists", async ({
    http,
    sdk,
  }) => {
    http.gateway("udp").get(`/identity/${serviceName}`).reply(200, linked);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        params: { service: serviceName, id: serviceId },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
  });

  it("returns 201 when an existing identity link ID is replaced", async ({
    http,
    sdk,
  }) => {
    http.gateway("udp").get(`/identity/${serviceName}`).reply(200, {
      serviceId: existingServiceId,
      serviceName,
    });
    http
      .gateway("udp")
      .delete(`/identity/${serviceName}/${existingServiceId}`)
      .reply(204);
    http
      .gateway("udp")
      .post(`/identity/${serviceName}/${serviceId}`, { body: identity })
      .reply(201);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        params: { service: serviceName, id: serviceId },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 502 when the UDP identity link integration fails", async ({
    http,
    sdk,
  }) => {
    http.gateway("udp").get(`/identity/${serviceName}`).reply(500);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        params: { service: serviceName, id: serviceId },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });

  it("returns 502 when the UDP delete identity link integration fails", async ({
    http,
    sdk,
  }) => {
    http.gateway("udp").get(`/identity/${serviceName}`).reply(200, {
      serviceId: existingServiceId,
      serviceName,
    });
    http
      .gateway("udp")
      .delete(`/identity/${serviceName}/${existingServiceId}`)
      .reply(500);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        params: { service: serviceName, id: serviceId },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });

  it("returns 502 when the UDP identity link creation fails", async ({
    http,
    sdk,
  }) => {
    http.gateway("udp").get(`/identity/${serviceName}`).reply(404);
    http
      .gateway("udp")
      .post(`/identity/${serviceName}/${serviceId}`, { body: identity })
      .reply(500);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        params: { service: serviceName, id: serviceId },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });
});
