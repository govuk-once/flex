import { generateKeyPairSync } from "node:crypto";

import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kmsMock = mockClient(KMSClient);

interface JwksResponse {
  keys: {
    kty: string;
    n: string;
    e: string;
    alg: string;
    use: string;
    kid: string;
    key_ops: string[];
  }[];
}

function generateTestKeyDer() {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return publicKey.export({ format: "der", type: "spki" });
}

async function importHandler() {
  const mod = await import("./handler");
  return mod.handler;
}

function parseBody(response: { body?: string }) {
  return JSON.parse(response.body ?? "{}") as JwksResponse;
}

describe("JWKS KMS handler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("KMS_KEY_ARNS", "arn:aws:kms:eu-west-2:123456789012:key/key-1");
    kmsMock.reset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns JWKS with correct structure", async () => {
    const derBytes = generateTestKeyDer();
    kmsMock.on(GetPublicKeyCommand).resolves({
      PublicKey: new Uint8Array(derBytes),
      KeyId: "arn:aws:kms:eu-west-2:123456789012:key/key-1",
    });

    const handler = await importHandler();
    const response = await handler();

    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
    });

    const body = parseBody(response);
    expect(body.keys).toHaveLength(1);

    const key = body.keys[0] ?? ({} as JwksResponse["keys"][number]);
    expect(key.kty).toBe("RSA");
    expect(key.alg).toBe("RSA-OAEP-256");
    expect(key.use).toBe("enc");
    expect(key.key_ops).toEqual(["encrypt", "wrapKey"]);
    expect(key.kid).toMatch(/^[a-f0-9]{64}$/);
    expect(key.n).toBeDefined();
    expect(key.e).toBeDefined();
  });

  it("supports multiple KMS key ARNs", async () => {
    vi.stubEnv(
      "KMS_KEY_ARNS",
      "arn:aws:kms:eu-west-2:123456789012:key/key-1,arn:aws:kms:eu-west-2:123456789012:key/key-2",
    );

    const derBytes1 = generateTestKeyDer();
    const derBytes2 = generateTestKeyDer();

    kmsMock
      .on(GetPublicKeyCommand, {
        KeyId: "arn:aws:kms:eu-west-2:123456789012:key/key-1",
      })
      .resolves({ PublicKey: new Uint8Array(derBytes1) })
      .on(GetPublicKeyCommand, {
        KeyId: "arn:aws:kms:eu-west-2:123456789012:key/key-2",
      })
      .resolves({ PublicKey: new Uint8Array(derBytes2) });

    const handler = await importHandler();
    const response = await handler();
    const body = parseBody(response);

    expect(body.keys).toHaveLength(2);

    const kids = body.keys.map((k) => k.kid);
    expect(new Set(kids).size).toBe(2);
  });

  it("generates deterministic kid from DER bytes", async () => {
    const derBytes = generateTestKeyDer();
    kmsMock.on(GetPublicKeyCommand).resolves({
      PublicKey: new Uint8Array(derBytes),
    });

    const handler1 = await importHandler();
    const response1 = await handler1();

    vi.resetModules();
    kmsMock.reset();
    kmsMock.on(GetPublicKeyCommand).resolves({
      PublicKey: new Uint8Array(derBytes),
    });

    const handler2 = await importHandler();
    const response2 = await handler2();

    const kids1 = parseBody(response1).keys.map((k) => k.kid);
    const kids2 = parseBody(response2).keys.map((k) => k.kid);
    expect(kids1).toEqual(kids2);
  });

  it("returns 500 when KMS_KEY_ARNS is not set", async () => {
    vi.stubEnv("KMS_KEY_ARNS", "");

    const handler = await importHandler();
    const response = await handler();

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body ?? "{}") as { message: string };
    expect(body.message).toBe("Internal Server Error");
  });

  it("returns 500 when KMS returns no public key", async () => {
    kmsMock.on(GetPublicKeyCommand).resolves({ PublicKey: undefined });

    const handler = await importHandler();
    const response = await handler();

    expect(response.statusCode).toBe(500);
  });

  it("uses in-memory cache on subsequent calls", async () => {
    const derBytes = generateTestKeyDer();
    kmsMock.on(GetPublicKeyCommand).resolves({
      PublicKey: new Uint8Array(derBytes),
    });

    const handler = await importHandler();

    const response1 = await handler();
    const response2 = await handler();

    expect(response1.statusCode).toBe(200);
    expect(response2.statusCode).toBe(200);
    expect(kmsMock.commandCalls(GetPublicKeyCommand)).toHaveLength(1);
  });
});
