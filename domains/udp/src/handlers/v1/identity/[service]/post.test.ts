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
import * as jose from "jose";
import { beforeAll, describe, expect } from "vitest";

import { handler } from "./post";

type ExtractCryptoKey = jose.GenerateKeyPairResult["privateKey"];

let privateKey: ExtractCryptoKey;
let mockJwkSetResponse: { keys: unknown[] };

beforeAll(async () => {
  const { privateKey: priv, publicKey: pub } = await jose.generateKeyPair(
    "PS256",
    {
      modulusLength: 2048,
    },
  );
  privateKey = priv;

  const publicJwk = await jose.exportJWK(pub);

  mockJwkSetResponse = {
    keys: [
      {
        ...publicJwk,
        use: "sig",
        alg: "PS256",
        kid: "alias/nonprod-govuk-app-jwt-signing-key",
      },
    ],
  };
});

const createMockDvlaJwt = async (
  linkingId: string,
  options?: { isExpired?: boolean; invalidAlg?: boolean },
) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const alg = options?.invalidAlg ? "RS256" : "PS256";

  const jwtSigner = new jose.SignJWT({
    iss: "https://govuk-app-external-ui.dvla.gov.uk",
    linking_id: linkingId,
  })
    .setProtectedHeader({
      alg,
      typ: "JWT",
      kid: "alias/nonprod-govuk-app-jwt-signing-key",
    })
    .setIssuedAt(options?.isExpired ? nowSeconds - 7200 : nowSeconds)
    .setExpirationTime(
      options?.isExpired ? nowSeconds - 3600 : nowSeconds + 3600,
    );

  if (options?.invalidAlg) {
    const { privateKey: badPriv } = await jose.generateKeyPair("RS256");
    return await jwtSigner.sign(badPriv);
  }

  return await jwtSigner.sign(privateKey);
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

  describe("DVLA Integration Testing", () => {
    const dvlaService = "dvla";
    const targetDvlaEndpoint = `/identity/${dvlaService}`;
    const jwksPath = "/well-known-jwks";

    it("extracts serviceId securely from JWT payload and updates it when the service is DVLA", async ({
      http,
      sdk,
    }) => {
      const dvlaToken = await createMockDvlaJwt(serviceId);

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

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
          headers: { "x-linking-token": dvlaToken },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(201);
    });

    it("returns 401 Unauthorized when the DVLA linking token has expired", async ({
      http,
      sdk,
    }) => {
      const expiredDvlaToken = await createMockDvlaJwt(serviceId, {
        isExpired: true,
      });

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": expiredDvlaToken },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(401);
    });

    it("returns 401 Unauthorized when token signature algorithm does not match the patched JWK parameters", async ({
      http,
      sdk,
    }) => {
      const invalidAlgToken = await createMockDvlaJwt(serviceId, {
        invalidAlg: true,
      });

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": invalidAlgToken },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(401);
    });

    it("returns 502 Bad Gateway when fetching the DVLA well-known JWK endpoint fails", async ({
      http,
      sdk,
    }) => {
      const dvlaToken = await createMockDvlaJwt(serviceId);

      http.gateway("dvla").get(jwksPath).reply(500);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": dvlaToken },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(502);
    });
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

      http
        .gateway("udp")
        .delete(`/identity/${serviceName}/${serviceId}`)
        .reply(204);

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
});
