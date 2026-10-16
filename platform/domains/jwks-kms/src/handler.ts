import { createHash, createPublicKey } from "node:crypto";

import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { logger } from "@flex/logging";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const kmsClient = new KMSClient({});

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface JwksCache {
  body: string;
  expiresAt: number;
}

let cache: JwksCache | undefined;

interface Jwk {
  kty: string;
  n: string;
  e: string;
  alg: string;
  use: string;
  kid: string;
  key_ops: string[];
}

function derToJwk(derBytes: Uint8Array): Jwk {
  const publicKey = createPublicKey({
    key: Buffer.from(derBytes),
    format: "der",
    type: "spki",
  });

  const exported = publicKey.export({ format: "jwk" }) as {
    kty: string;
    n: string;
    e: string;
  };

  const kid = createHash("sha256").update(derBytes).digest("hex");

  return {
    kty: exported.kty,
    n: exported.n,
    e: exported.e,
    alg: "RSA-OAEP-256",
    use: "enc",
    kid,
    key_ops: ["encrypt", "wrapKey"],
  };
}

async function fetchJwks(): Promise<Jwk[]> {
  const keyArns = process.env.KMS_KEY_ARNS;
  if (!keyArns) {
    throw new Error("KMS_KEY_ARNS environment variable is not set");
  }

  const arns = keyArns.split(",").filter(Boolean);
  const keys = await Promise.all(
    arns.map(async (arn) => {
      const response = await kmsClient.send(
        new GetPublicKeyCommand({ KeyId: arn.trim() }),
      );

      if (!response.PublicKey) {
        throw new Error(`No public key returned for ${arn}`);
      }

      return derToJwk(response.PublicKey);
    }),
  );

  return keys;
}

export async function handler(): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const now = Date.now();
    if (cache && now < cache.expiresAt) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        },
        body: cache.body,
      };
    }

    const keys = await fetchJwks();
    const body = JSON.stringify({ keys });

    cache = { body, expiresAt: now + CACHE_TTL_MS };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
      body,
    };
  } catch (error) {
    logger.error("Failed to fetch JWKS from KMS", { error });

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
