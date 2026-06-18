import { it } from "@flex/testing";
import {
  createServiceName,
  serviceIdentityLink,
  serviceName,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./delete";

describe("DELETE /v1/identity/:service", () => {
  const normalizedServiceName = serviceName.toLowerCase();
  const endpoint = `/identity/${normalizedServiceName}`;

  const activeService = createServiceName("test-active-service");

  it("returns 204 when the service identity is unlinked and removed from the tracking list", async ({
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
      .get(`/identities/${userId}`)
      .reply(200, {
        data: { services: [normalizedServiceName, activeService] },
      });

    http
      .gateway("udp")
      .post(`/identities/${userId}`, {
        body: { data: { services: [activeService] } },
      })
      .reply(200);

    http
      .gateway("udp")
      .delete(
        `/identity/${serviceIdentityLink.serviceName}/${serviceIdentityLink.serviceId}`,
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

  it("returns 204 and clears the tracking list when the target is the only linked service", async ({
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
      .get(`/identities/${userId}`)
      .reply(200, { data: { services: [normalizedServiceName] } });

    http
      .gateway("udp")
      .post(`/identities/${userId}`, { body: { data: { services: [] } } })
      .reply(200);

    http
      .gateway("udp")
      .delete(
        `/identity/${serviceIdentityLink.serviceName}/${serviceIdentityLink.serviceId}`,
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

  it("returns 204 when the linked service exists and the tracking list is already empty", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${normalizedServiceName}`, {
        headers: { "User-Id": userId },
      })
      .reply(200, serviceIdentityLink);

    http.gateway("udp").get(`/identities/${userId}`).reply(404);

    http
      .gateway("udp")
      .delete(
        `/identity/${serviceIdentityLink.serviceName}/${serviceIdentityLink.serviceId}`,
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
        .get(`/identities/${userId}`)
        .reply(200, { data: { services: [normalizedServiceName] } });

      http
        .gateway("udp")
        .post(`/identities/${userId}`, { body: { data: { services: [] } } })
        .reply(200);

      http
        .gateway("udp")
        .delete(
          `/identity/${serviceIdentityLink.serviceName}/${serviceIdentityLink.serviceId}`,
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

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP get service identities integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .gateway("udp")
        .get(`/identity/${normalizedServiceName}`, {
          headers: { "User-Id": userId },
        })
        .reply(200, serviceIdentityLink);

      http.gateway("udp").get(`/identities/${userId}`).reply(upstream);

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

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP post service identities integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .gateway("udp")
        .get(`/identity/${normalizedServiceName}`, {
          headers: { "User-Id": userId },
        })
        .reply(200, serviceIdentityLink);

      http
        .gateway("udp")
        .get(`/identities/${userId}`)
        .reply(200, {
          data: { services: [normalizedServiceName, activeService] },
        });

      http
        .gateway("udp")
        .post(`/identities/${userId}`, {
          body: { data: { services: [activeService] } },
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

  it("attempts to roll back by re-appending the service to the master list if the key-value link deletion fails", async ({
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
      .get(`/identities/${userId}`)
      .reply(200, {
        data: { services: [normalizedServiceName, activeService] },
      });

    http
      .gateway("udp")
      .post(`/identities/${userId}`, {
        body: { data: { services: [activeService] } },
      })
      .reply(200);

    http
      .gateway("udp")
      .delete(
        `/identity/${serviceIdentityLink.serviceName}/${serviceIdentityLink.serviceId}`,
      )
      .reply(500);

    http
      .gateway("udp")
      .get(`/identities/${userId}`)
      .reply(200, { data: { services: [activeService] } });

    http
      .gateway("udp")
      .post(`/identities/${userId}`, {
        body: { data: { services: [activeService, normalizedServiceName] } },
      })
      .reply(200);

    const result = await handler(
      sdk.event.delete(endpoint, {
        userId,
        params: { service: serviceName },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
