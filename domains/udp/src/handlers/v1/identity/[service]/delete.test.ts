import { it } from "@flex/testing";
import {
  serviceIdentityLink,
  serviceName,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./delete";

describe("DELETE /v1/identity/:service", () => {
  const normalizedServiceName = serviceName.toLowerCase();
  const endpoint = `/identity/${normalizedServiceName}`;

  it("returns 204 when the service identity is successfully unlinked", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${normalizedServiceName}`, {
        headers: { "User-Id": userId },
      })
      .reply(200, serviceIdentityLink);

    http
      .gateway("udp")
      .delete(
        `/identity/${normalizedServiceName}/${serviceIdentityLink.serviceId}`,
      )
      .reply(204);

    const result = await handler(
      sdk.event.delete(endpoint, {
        userId,
        params: { service: serviceName },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
  });

  it.for([
    { reason: "cannot find the link", upstream: 404, expected: 404 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UDP get service identity link integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .gateway("udp")
        .get(`/identity/${normalizedServiceName}`, {
          headers: { "User-Id": userId },
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.delete(endpoint, {
          userId,
          params: { service: serviceName },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.todo.for([
    // If the delete target is already 404, an idempotent DELETE should consider it a success (204)
    { reason: "cannot find the link", upstream: 404, expected: 204 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UDP delete service identity link integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .gateway("udp")
        .get(`/identity/${normalizedServiceName}`, {
          headers: { "User-Id": userId },
        })
        .reply(200, serviceIdentityLink);

      http
        .gateway("udp")
        .delete(
          `/identity/${normalizedServiceName}/${serviceIdentityLink.serviceId}`,
        )
        .reply(upstream);

      const result = await handler(
        sdk.event.delete(endpoint, {
          userId,
          params: { service: serviceName },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
