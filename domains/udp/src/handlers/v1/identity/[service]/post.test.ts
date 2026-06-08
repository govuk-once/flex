import { it } from "@flex/testing";
import {
  createServiceId,
  createServiceIdentityLink,
  createServiceName,
  serviceId,
  serviceIdentityLink,
  serviceIdentityLinkRequest,
  serviceName,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post";

const createMockDvlaJwt = (linkingId: string) => {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64");
  const payload = Buffer.from(
    JSON.stringify({ linking_id: linkingId }),
  ).toString("base64");
  return `${header}.${payload}.signaturehere`;
};

describe("POST /v1/identity/:service", () => {
  const endpoint = `/identity/${serviceName}`;
  const standardHeaders = { "x-linking-token": serviceId };

  const existingService = createServiceName("test-existing-service");

  it("returns 201 when the service identity is linked and appended to the tracking list", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(404);
    http.gateway("udp").get(`/identities/${userId}`).reply(404);
    http
      .gateway("udp")
      .post(`/identity/${serviceName}/${serviceId}`, {
        body: serviceIdentityLinkRequest,
      })
      .reply(201);
    http
      .gateway("udp")
      .post(`/identities/${userId}`, {
        body: { data: { services: [serviceName] } },
      })
      .reply(200);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: serviceName },
        headers: standardHeaders,
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("extracts serviceId securely from JWT payload when the service is DVLA", async ({
    http,
    sdk,
  }) => {
    const dvlaService = "dvla";
    const targetDvlaEndpoint = `/identity/${dvlaService}`;
    const dvlaToken = createMockDvlaJwt(serviceId);

    http
      .gateway("udp")
      .get(`/identity/${dvlaService}`, { headers: { "User-Id": userId } })
      .reply(404);
    http.gateway("udp").get(`/identities/${userId}`).reply(404);
    http
      .gateway("udp")
      .post(`/identity/${dvlaService}/${serviceId}`, {
        body: serviceIdentityLinkRequest,
      })
      .reply(201);
    http
      .gateway("udp")
      .post(`/identities/${userId}`, {
        body: { data: { services: [dvlaService] } },
      })
      .reply(200);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        // FIX: Change 'linkingToken' to 'x-linking-token' so your handler validation recognizes it
        headers: { "x-linking-token": dvlaToken },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
  });

  it("returns 201 when the service identity link is already tracked", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(404);
    http
      .gateway("udp")
      .get(`/identities/${userId}`)
      .reply(200, { data: { services: [serviceName, existingService] } });
    http
      .gateway("udp")
      .post(`/identity/${serviceName}/${serviceId}`, {
        body: serviceIdentityLinkRequest,
      })
      .reply(201);
    http
      .gateway("udp")
      .post(`/identities/${userId}`, {
        body: { data: { services: [serviceName, existingService] } },
      })
      .reply(200);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: serviceName },
        headers: standardHeaders,
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 204 when the service identity is already linked with the same ID", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(200, serviceIdentityLink);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: serviceName },
        headers: standardHeaders,
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
  });

  it("returns 201 and appends to the tracking list if absent when the service identity is unlinked with an old ID", async ({
    http,
    sdk,
  }) => {
    const oldServiceId = createServiceId("test-old-service-id");
    const existingServiceIdentity = createServiceIdentityLink({
      serviceId: oldServiceId,
    });

    http
      .gateway("udp")
      .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
      .reply(200, existingServiceIdentity);
    http
      .gateway("udp")
      .delete(
        `/identity/${existingServiceIdentity.serviceName}/${oldServiceId}`,
      )
      .reply(204);
    http
      .gateway("udp")
      .get(`/identities/${userId}`)
      .reply(200, { data: { services: [existingService] } });
    http
      .gateway("udp")
      .post(`/identity/${serviceName}/${serviceId}`, {
        body: serviceIdentityLinkRequest,
      })
      .reply(201);
    http
      .gateway("udp")
      .post(`/identities/${userId}`, {
        body: { data: { services: [existingService, serviceName] } },
      })
      .reply(200);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: serviceName },
        headers: standardHeaders,
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP get service identity link integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: serviceName },
          headers: standardHeaders,
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([
    { reason: "cannot find the old link", upstream: 404, expected: 502 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UDP delete service identity link integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      const oldServiceId = createServiceId("test-old-service-id");
      const existingServiceIdentity = createServiceIdentityLink({
        serviceId: oldServiceId,
      });

      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(200, existingServiceIdentity);

      http
        .gateway("udp")
        .delete(
          `/identity/${existingServiceIdentity.serviceName}/${oldServiceId}`,
        )
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: serviceName },
          headers: standardHeaders,
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP create service identity integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(404);
      http.gateway("udp").get(`/identities/${userId}`).reply(404);
      http
        .gateway("udp")
        .post(`/identities/${userId}`, {
          body: { data: { services: [serviceName] } },
        })
        .reply(200);

      http
        .gateway("udp")
        .post(`/identity/${serviceName}/${serviceId}`, {
          body: serviceIdentityLinkRequest,
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: serviceName },
          headers: standardHeaders,
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
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(404);
      http
        .gateway("udp")
        .post(`/identity/${serviceName}/${serviceId}`, {
          body: serviceIdentityLinkRequest,
        })
        .reply(201);

      http.gateway("udp").get(`/identities/${userId}`).reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: serviceName },
          headers: standardHeaders,
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
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(404);
      http.gateway("udp").get(`/identities/${userId}`).reply(404);
      http
        .gateway("udp")
        .post(`/identity/${serviceName}/${serviceId}`, {
          body: serviceIdentityLinkRequest,
        })
        .reply(201);

      http
        .gateway("udp")
        .post(`/identities/${userId}`, {
          body: { data: { services: [serviceName] } },
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: serviceName },
          headers: standardHeaders,
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
