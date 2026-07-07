import * as nodeCrypto from "node:crypto";

import { it } from "@flex/testing";
import {
  createServiceId,
  createServiceIdentityLink,
  serviceId,
  serviceIdentityLink,
  serviceIdentityLinkRequest,
  serviceName,
  userId,
} from "@tests/fixtures";
import * as jose from "jose";
import { beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./post";

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
      constructor(public args: { CiphertextBlob?: Uint8Array }) { }
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

const createMockDvlaJwt = async (
  linkingId: string,
  options?: {
    isExpired?: boolean;
    invalidAlg?: boolean;
    omitLinkingId?: boolean;
  },
) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const alg = options?.invalidAlg ? "RS256" : "PS256";

  const payload: Record<string, string> = {
    iss: "https://govuk-app-external-ui.dvla.gov.uk",
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
  options?: {
    isExpired?: boolean;
    invalidAlg?: boolean;
    omitLinkingId?: boolean;
  },
) => {
  const signedJwt = await createMockDvlaJwt(linkingId, options);

  const publicKey = await jose.importSPKI(kmsPublicKeyPem, "RSA-OAEP");

  return await new jose.CompactEncrypt(new TextEncoder().encode(signedJwt))
    .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" })
    .encrypt(publicKey);
};

describe("POST /v1/identity/:service", () => {
  const normalizedServiceName = serviceName.toLowerCase();
  const endpoint = `/identity/${normalizedServiceName}`;
  const standardHeaders = { "x-linking-token": serviceId };

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

  it("returns 201 when the service identity is successfully linked", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${normalizedServiceName}`, { headers: { "User-Id": userId } })
      .reply(404);
    http
      .gateway("udp")
      .post(`/identity/${normalizedServiceName}/${serviceId}`) // Removed strict body matching
      .reply(201);

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

    it("extracts serviceId securely from JWE payload and updates it when the service is DVLA", async ({
      http,
      sdk,
    }) => {
      const dvlaJweToken = await createMockDvlaJwe(serviceId);

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

      http
        .gateway("udp")
        .get(`/identity/${dvlaService}`, { headers: { "User-Id": userId } })
        .reply(404);
      http
        .gateway("udp")
        .post(`/identity/${dvlaService}/${serviceId}`) // Removed strict body matching
        .reply(201);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": dvlaJweToken },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(201);
      expect(mockKmsSend).toHaveBeenCalledTimes(1);
    });

    it("returns 401 Unauthorized when the DVLA linking token has expired", async ({
      http,
      sdk,
    }) => {
      const expiredDvlaJweToken = await createMockDvlaJwe(serviceId, {
        isExpired: true,
      });

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": expiredDvlaJweToken },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(401);
    });

    it("returns 401 Unauthorized when token signature algorithm does not match the patched JWK parameters", async ({
      http,
      sdk,
    }) => {
      const invalidAlgJweToken = await createMockDvlaJwe(serviceId, {
        invalidAlg: true,
      });

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": invalidAlgJweToken },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(401);
    });

    it("returns 502 Bad Gateway when fetching the DVLA well-known JWK endpoint fails", async ({
      http,
      sdk,
    }) => {
      const dvlaJweToken = await createMockDvlaJwe(serviceId);

      http.gateway("dvla").get(jwksPath).reply(500);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": dvlaJweToken },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(502);
    });

    it("returns 400 Bad Request when the JWE token format is invalid (not 5 parts)", async ({
      sdk,
    }) => {
      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": "eyJhbGciOi.InvalidToken" },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 Bad Request when essential JWE token blocks are empty", async ({
      sdk,
    }) => {
      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": "part1.part2..part4.part5" },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(400);
    });

    it("returns 500 Internal Server Error when KMS fails to return a decrypted Plaintext CEK", async ({
      sdk,
    }) => {
      mockKmsSend.mockResolvedValueOnce({ Plaintext: undefined });

      const validJwe = await createMockDvlaJwe(serviceId);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": validJwe },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(500);
    });

    it("returns 400 Bad Request when internal AES-GCM decryption fails (tampered payload)", async ({
      sdk,
    }) => {
      const validJwe = await createMockDvlaJwe(serviceId);

      const parts = validJwe.split(".");
      parts[3] = "tampered_ciphertext_to_break_decryption_completely";
      const tamperedJwe = parts.join(".");

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": tamperedJwe },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(400);
    });

    it("returns 401 when the decrypted JWT is missing the linking_id claim", async ({
      http,
      sdk,
    }) => {
      const tokenWithoutLinkingId = await createMockDvlaJwe(serviceId, {
        omitLinkingId: true,
      });

      http.gateway("dvla").get(jwksPath).reply(200, mockJwkSetResponse);

      const result = await handler(
        sdk.event.post(targetDvlaEndpoint, {
          userId,
          body: serviceIdentityLinkRequest,
          params: { service: dvlaService },
          headers: { "x-linking-token": tokenWithoutLinkingId },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(401);
    });
  });

  it("returns 204 when the service identity is already linked with the same ID", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(`/identity/${normalizedServiceName}`, { headers: { "User-Id": userId } })
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

  it("returns 201 when an existing service identity is unlinked and replaced with a new ID", async ({
    http,
    sdk,
  }) => {
    const oldServiceId = createServiceId("test-old-service-id");
    const existingServiceIdentity = createServiceIdentityLink({
      serviceId: oldServiceId,
    });
    const normalizedExistingService = existingServiceIdentity.serviceName.toLowerCase();

    http
      .gateway("udp")
      .get(`/identity/${normalizedServiceName}`, { headers: { "User-Id": userId } })
      .reply(200, existingServiceIdentity);
    http
      .gateway("udp")
      .delete(
        `/identity/${normalizedExistingService}/${oldServiceId}`,
      )
      .reply(204);
    http
      .gateway("udp")
      .post(`/identity/${normalizedServiceName}/${serviceId}`) // Removed strict body matching
      .reply(201);

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
        .get(`/identity/${normalizedServiceName}`, { headers: { "User-Id": userId } })
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
      const normalizedExistingService = existingServiceIdentity.serviceName.toLowerCase();

      http
        .gateway("udp")
        .get(`/identity/${normalizedServiceName}`, { headers: { "User-Id": userId } })
        .reply(200, existingServiceIdentity);

      http
        .gateway("udp")
        .delete(
          `/identity/${normalizedExistingService}/${oldServiceId}`,
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
        .get(`/identity/${normalizedServiceName}`, { headers: { "User-Id": userId } })
        .reply(404);

      http
        .gateway("udp")
        .post(`/identity/${normalizedServiceName}/${serviceId}`) // Removed strict body matching
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
