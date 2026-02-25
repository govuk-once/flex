import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { getValidatedSecret } from "@flex/utils";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";

interface JwkPublicKey {
  alg: string;
  e: string;
  kty: string;
  n: string;
  use: string;
  kid: string;
}

interface JwksResponse {
  keys: JwkPublicKey[];
}

const secretClient = new SecretsManagerClient();
let cachedJwks: JwksResponse | null = null;

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
  try {
    if (cachedJwks) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cachedJwks),
      };
    }

    const privateKeyData = await getValidatedSecret(
      secretClient,
      "/development/flex-secret/auth/e2e/private_jwk",
      z.object({
        n: z.string(),
        kid: z.string(),
      }),
    );

    const jwks = {
      keys: [
        {
          alg: "RS256",
          e: "AQAB",
          kty: "RSA",
          n: privateKeyData.n,
          use: "sig",
          kid: privateKeyData.kid,
        },
      ],
    };

    cachedJwks = jwks;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jwks),
    };
  } catch (error) {
    console.error("Error fetching JWKS:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
