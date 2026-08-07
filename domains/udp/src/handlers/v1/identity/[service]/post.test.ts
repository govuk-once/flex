import * as nodeCrypto from "node:crypto";

import { it, uuid } from "@flex/testing";
import {
  createServiceId,
  createServiceIdentityLink,
  secrets,
  serviceId,
  serviceIdentityLinkRequest,
  userId,
} from "@tests/fixtures";
import * as jose from "jose";
import { beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./post";

const MOCK_DVLA_JWT_ISSUER = "https://govuk-app-external-ui.dvla.gov.uk";

const { mockKmsSend } = vi.hoisted(() => {
  process.env.decyrptionKey = "mock-kms-key-id";
  process.env.KMS_KEY_ID = "mock-kms-key-id";
  process.env.AWS_REGION = "eu-west-1";

  return {
    mockKmsSend: vi.fn(),
  };
});

vi.mock("@aws-sdk/client-kms", () => {
  return {
    KMSClient: class {
      send = mockKmsSend;
    },
    DecryptCommand: class {
      constructor(public args: { CiphertextBlob?: Uint8Array }) {}
    },
  };
});

type ExtractCryptoKey = jose.GenerateKeyPairResult["privateKey"];

let privateKey: ExtractCryptoKey;
let mockJwkSetResponse: { keys: unknown[] };

let kmsPrivateKey: nodeCrypto.KeyObject;
let kmsPublicKeyPem: string;

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

  // Generate mock AWS KMS RSA Key Pair for JWE wrapping
  const rsaKeys = nodeCrypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  kmsPrivateKey = rsaKeys.privateKey;
  kmsPublicKeyPem = rsaKeys.publicKey;
});

const createMockSession = async (sub: string) => {
  const { privateKey } = await jose.generateKeyPair("PS256", {
    modulusLength: 2048,
  });
  const accessToken = await new jose.SignJWT({})
    .setProtectedHeader({
      alg: "PS256",
    })
    .setSubject(sub)
    .sign(privateKey);
  const sessionHash = nodeCrypto
    .createHmac("sha256", "test-key")
    .update(sub)
    .digest("hex");
  return {
    accessToken,
    sessionHash,
  };
};

type MockDvlaJwtOptions = {
  isExpired?: boolean;
  invalidAlg?: boolean;
  omitLinkingId?: boolean;
  issuer?: string;
  audience?: string;
};

const createMockDvlaJwt = async (
  linkingId: string,
  sessionHash: string,
  options?: MockDvlaJwtOptions,
) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const alg = options?.invalidAlg ? "RS256" : "PS256";

  const payload: Record<string, string> = {
    iss: options?.issuer ?? MOCK_DVLA_JWT_ISSUER,
    session: sessionHash,
  };

  if (!options?.omitLinkingId) {
    payload.linking_id = linkingId;
  }

  const jwtSigner = new jose.SignJWT(payload)
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

const createMockDvlaJwe = async (
  linkingId: string,
  sessionHash: string,
  options?: MockDvlaJwtOptions,
) => {
  const signedJwt = await createMockDvlaJwt(linkingId, sessionHash, options);

  const publicKey = await jose.importSPKI(kmsPublicKeyPem, "RSA-OAEP");

  return await new jose.CompactEncrypt(new TextEncoder().encode(signedJwt))
    .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" })
    .encrypt(publicKey);
};

describe("POST /v1/identity/:service", () => {
  const dvlaService = "dvla";
  const targetDvlaEndpoint = `/identity/${dvlaService}`;
  const jwksPath = "/well-known-jwks";

  interface MockCommand {
    args?: { CiphertextBlob?: Uint8Array };
    CiphertextBlob?: Uint8Array;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockKmsSend.mockImplementation((command: MockCommand) => {
      const ciphertextBlob =
        command.args?.CiphertextBlob ?? command.CiphertextBlob;

      if (!ciphertextBlob) {
        throw new Error(
          "Mock Error: CiphertextBlob was missing in KMS DecryptCommand",
        );
      }

      const decryptedCek = nodeCrypto.privateDecrypt(
        {
          key: kmsPrivateKey,
          padding: nodeCrypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha1",
        },
        Buffer.from(ciphertextBlob),
      );

      return Promise.resolve({
        Plaintext: new Uint8Array(decryptedCek),
      });
    });
  });

  it("returns 403 Forbidden when service is not DVLA", async ({ sdk }) => {
    const sub = uuid;
    const { accessToken } = await createMockSession(sub);

    const result = await handler(
      sdk.event.post("/identity/other-service", {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: "other-service" },
        headers: {
          "x-linking-token": serviceId,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(403);
  });

  it("returns 201 when the service identity is successfully linked for DVLA", async ({
    http,
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);
    const dvlaJweToken = await createMockDvlaJwe(serviceId, sessionHash);

    http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

    http
      .gateway("udp")
      .get(`/identity/${dvlaService}`, {
        headers: { "User-Id": userId },
      })
      .reply(404);
    http
      .gateway("udp")
      .post(`/identity/${dvlaService}/${serviceId}`)
      .reply(201);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": dvlaJweToken,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(201);
    expect(mockKmsSend).toHaveBeenCalledTimes(1);
  });

  it("returns 401 Unauthorized when the DVLA linking token has expired", async ({
    http,
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);
    const expiredDvlaJweToken = await createMockDvlaJwe(
      serviceId,
      sessionHash,
      { isExpired: true },
    );

    http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": expiredDvlaJweToken,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(401);
  });

  it("returns 401 Unauthorized when token signature algorithm does not match JWK parameters", async ({
    http,
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);
    const invalidAlgJweToken = await createMockDvlaJwe(serviceId, sessionHash, {
      invalidAlg: true,
    });

    http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": invalidAlgJweToken,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(401);
  });

  it("returns 401 Unauthorized when the provided issuer does not match the DVLA JWT issuer", async ({
    http,
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);

    const dvlaJweToken = await createMockDvlaJwe(serviceId, sessionHash, {
      issuer: "https://unknown-issuer.dvla.gov.uk",
    });

    http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          Authorization: accessToken,
          "x-linking-token": dvlaJweToken,
        },
      }),
      sdk.context({ secrets }),
    );
    expect(result.statusCode).toBe(401);
  });

  it("returns 502 Bad Gateway when fetching the DVLA well-known JWK endpoint fails", async ({
    http,
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);
    const dvlaJweToken = await createMockDvlaJwe(serviceId, sessionHash);

    http.gateway("dvla").get(jwksPath).reply(500);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": dvlaJweToken,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
  });

  it("returns 400 Bad Request when the JWE token format is invalid (not 5 parts)", async ({
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken } = await createMockSession(sub);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": "eyJhbGciOi.InvalidToken",
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 400 Bad Request when essential JWE token blocks are empty", async ({
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken } = await createMockSession(sub);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": "part1.part2..part4.part5",
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 Internal Server Error when KMS fails to return a decrypted Plaintext CEK", async ({
    sdk,
  }) => {
    mockKmsSend.mockResolvedValueOnce({ Plaintext: undefined });

    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);
    const validJwe = await createMockDvlaJwe(serviceId, sessionHash);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: { "x-linking-token": validJwe, Authorization: accessToken },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(500);
  });

  it("returns 400 Bad Request when internal AES-GCM decryption fails (tampered payload)", async ({
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);
    const validJwe = await createMockDvlaJwe(serviceId, sessionHash);

    const parts = validJwe.split(".");
    parts[3] = "tampered_ciphertext_to_break_decryption_completely";
    const tamperedJwe = parts.join(".");

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": tamperedJwe,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 401 when the decrypted JWT is missing the linking_id claim", async ({
    http,
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);
    const tokenWithoutLinkingId = await createMockDvlaJwe(
      serviceId,
      sessionHash,
      { omitLinkingId: true },
    );

    http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": tokenWithoutLinkingId,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(401);
  });

  it("returns 401 when the calculated session hash doesn't match the provided one", async ({
    http,
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken } = await createMockSession(sub);
    const tokenWithMismatchedHash = await createMockDvlaJwe(
      serviceId,
      "mismatched-hash",
    );

    http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": tokenWithMismatchedHash,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(401);
  });

  it("returns 204 when the service identity is already linked with the same ID", async ({
    http,
    sdk,
  }) => {
    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);
    const dvlaJweToken = await createMockDvlaJwe(serviceId, sessionHash);

    http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

    const dvlaLink = createServiceIdentityLink({
      serviceId,
      serviceName: dvlaService,
    });

    http
      .gateway("udp")
      .get(`/identity/${dvlaService}`, {
        headers: { "User-Id": userId },
      })
      .reply(200, dvlaLink);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": dvlaJweToken,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
  });

  it("returns 201 when an existing service identity is unlinked and replaced with a new ID", async ({
    http,
    sdk,
  }) => {
    const oldServiceId = createServiceId("test-old-service-id");
    const existingServiceIdentity = createServiceIdentityLink({
      serviceId: oldServiceId,
      serviceName: dvlaService,
    });

    const sub = uuid;
    const { accessToken, sessionHash } = await createMockSession(sub);
    const dvlaJweToken = await createMockDvlaJwe(serviceId, sessionHash);

    http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

    http
      .gateway("udp")
      .get(`/identity/${dvlaService}`, {
        headers: { "User-Id": userId },
      })
      .reply(200, existingServiceIdentity);
    http
      .gateway("udp")
      .delete(`/identity/${dvlaService}/${oldServiceId}`)
      .reply(204);
    http
      .gateway("udp")
      .post(`/identity/${dvlaService}/${serviceId}`)
      .reply(201);

    const result = await handler(
      sdk.event.post(targetDvlaEndpoint, {
        userId,
        body: serviceIdentityLinkRequest,
        params: { service: dvlaService },
        headers: {
          "x-linking-token": dvlaJweToken,
          Authorization: accessToken,
        },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP get service identity link integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      const sub = uuid;
      const { accessToken, sessionHash } = await createMockSession(sub);
      const dvlaJweToken = await createMockDvlaJwe(serviceId, sessionHash);

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

      http
        .gateway("udp")
        .get(`/identity/${dvlaService}`, {
          headers: { "User-Id": userId },
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: {
            "x-linking-token": dvlaJweToken,
            Authorization: accessToken,
          },
        }),
        sdk.context({ secrets }),
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
      const sub = uuid;
      const { accessToken, sessionHash } = await createMockSession(sub);
      const dvlaJweToken = await createMockDvlaJwe(serviceId, sessionHash);

      const oldServiceId = createServiceId("test-old-service-id");
      const existingServiceIdentity = createServiceIdentityLink({
        serviceId: oldServiceId,
        serviceName: dvlaService,
      });

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

      http
        .gateway("udp")
        .get(`/identity/${dvlaService}`, {
          headers: { "User-Id": userId },
        })
        .reply(200, existingServiceIdentity);

      http
        .gateway("udp")
        .delete(`/identity/${dvlaService}/${oldServiceId}`)
        .reply(upstream);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: {
            "x-linking-token": dvlaJweToken,
            Authorization: accessToken,
          },
        }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP create service identity integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      const sub = uuid;
      const { accessToken, sessionHash } = await createMockSession(sub);
      const dvlaJweToken = await createMockDvlaJwe(serviceId, sessionHash);

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

      http
        .gateway("udp")
        .get(`/identity/${dvlaService}`, {
          headers: { "User-Id": userId },
        })
        .reply(404);

      http
        .gateway("udp")
        .post(`/identity/${dvlaService}/${serviceId}`)
        .reply(upstream);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: {
            "x-linking-token": dvlaJweToken,
            Authorization: accessToken,
          },
        }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
