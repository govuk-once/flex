import { it } from "@flex/testing";
import { serviceIdentityLink, serviceName, userId } from "@tests/fixtures";
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

  it.for([
    { reason: "cannot find the link", upstream: 404, expected: 502 },
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

  describe("Unlink tests when service is 'dvla'", () => {
    const dvlaEndpoint = "/identity/dvla";

    it("calls dvlaUnlinkUser integration, logs the result, and returns 204", async ({
      http,
      sdk,
    }) => {
      const dvlaResponse = { success: true };

      http
        .gateway("udp")
        .get("/identity/dvla", {
          headers: { "User-Id": userId },
        })
        .reply(200, { ...serviceIdentityLink, serviceName: "dvla" });

      http
        .gateway("udp")
        .delete(`/identity/dvla/${serviceIdentityLink.serviceId}`)
        .reply(204);

      http
        .domain("dvla")
        .post(`/unlink/${serviceIdentityLink.serviceId}`)
        .reply(200, dvlaResponse);

      const result = await handler(
        sdk.event.delete(dvlaEndpoint, {
          userId,
          params: { service: "dvla" },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(204);
    });

    it("still returns 204 even if dvlaUnlinkUser integration fails", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get("/identity/dvla", {
          headers: { "User-Id": userId },
        })
        .reply(200, { ...serviceIdentityLink, serviceName: "dvla" });

      http
        .gateway("udp")
        .delete(`/identity/dvla/${serviceIdentityLink.serviceId}`)
        .reply(204);

      http
        .domain("dvla")
        .post(`/unlink/${serviceIdentityLink.serviceId}`)
        .reply(500, { message: "DVLA system error" });

      const result = await handler(
        sdk.event.delete(dvlaEndpoint, {
          userId,
          params: { service: "DVLA" },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(204);
    });
  });
});
