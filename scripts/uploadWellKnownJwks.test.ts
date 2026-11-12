import { generateKeyPairSync } from "node:crypto";

import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kmsMock = mockClient(KMSClient);
const s3Mock = mockClient(S3Client);
const ssmMock = mockClient(SSMClient);

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

describe("uploadWellKnownJwks", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("STAGE", "development");
    kmsMock.reset();
    s3Mock.reset();
    ssmMock.reset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function runScript() {
    await import("./uploadWellKnownJwks");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  it("fetches KMS keys and uploads JWKS to S3", async () => {
    const derBytes = generateTestKeyDer();

    ssmMock.on(GetParameterCommand).resolves({
      Parameter: {
        Value: "arn:aws:kms:eu-west-2:123456789012:key/key-1",
      },
    });

    kmsMock.on(GetPublicKeyCommand).resolves({
      PublicKey: new Uint8Array(derBytes),
    });

    s3Mock.on(PutObjectCommand).resolves({});

    await runScript();

    const s3Calls = s3Mock.commandCalls(PutObjectCommand);
    expect(s3Calls).toHaveLength(1);

    const putCall = s3Calls[0]!.args[0].input;
    expect(putCall.Bucket).toBe("flex-development-well-known");
    expect(putCall.Key).toBe(".well-known/jwks.json");
    expect(putCall.ContentType).toBe("application/json");
    expect(putCall.CacheControl).toBe(
      "public, max-age=86400, stale-while-revalidate=3600",
    );

    const body = JSON.parse(putCall.Body as string) as JwksResponse;
    expect(body.keys).toHaveLength(1);

    const key = body.keys[0]!;
    expect(key.kty).toBe("RSA");
    expect(key.alg).toBe("RSA-OAEP-256");
    expect(key.use).toBe("enc");
    expect(key.key_ops).toEqual(["encrypt", "wrapKey"]);
    expect(key.kid).toMatch(/^[a-f0-9]{64}$/);
    expect(key.n).toBeDefined();
    expect(key.e).toBeDefined();
  });

  it("supports multiple KMS key ARNs", async () => {
    const derBytes1 = generateTestKeyDer();
    const derBytes2 = generateTestKeyDer();

    ssmMock.on(GetParameterCommand).resolves({
      Parameter: {
        Value:
          "arn:aws:kms:eu-west-2:123456789012:key/key-1,arn:aws:kms:eu-west-2:123456789012:key/key-2",
      },
    });

    kmsMock
      .on(GetPublicKeyCommand, {
        KeyId: "arn:aws:kms:eu-west-2:123456789012:key/key-1",
      })
      .resolves({ PublicKey: new Uint8Array(derBytes1) })
      .on(GetPublicKeyCommand, {
        KeyId: "arn:aws:kms:eu-west-2:123456789012:key/key-2",
      })
      .resolves({ PublicKey: new Uint8Array(derBytes2) });

    s3Mock.on(PutObjectCommand).resolves({});

    await runScript();

    const s3Calls = s3Mock.commandCalls(PutObjectCommand);
    expect(s3Calls).toHaveLength(1);

    const body = JSON.parse(
      s3Calls[0]!.args[0].input.Body as string,
    ) as JwksResponse;
    expect(body.keys).toHaveLength(2);

    const kids = body.keys.map((k) => k.kid);
    expect(new Set(kids).size).toBe(2);
  });

  it("exits with code 1 when SSM parameter is missing", async () => {
    ssmMock.on(GetParameterCommand).resolves({
      Parameter: { Value: undefined },
    });

    await runScript();

    expect(process.exitCode).toBe(1);
  });

  it("exits with code 1 when KMS returns no public key", async () => {
    ssmMock.on(GetParameterCommand).resolves({
      Parameter: {
        Value: "arn:aws:kms:eu-west-2:123456789012:key/key-1",
      },
    });

    kmsMock.on(GetPublicKeyCommand).resolves({ PublicKey: undefined });

    await runScript();

    expect(process.exitCode).toBe(1);
  });
});
