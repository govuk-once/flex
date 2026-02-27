import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";

const SecretSchema = z.object({
  n: z.string(),
  kid: z.string(),
});

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

const SECRET_NAME = "/development/flex-secret/auth/e2e/private_jwk";
const CACHE_MAX_AGE = 300;

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
  try {
    const rawSecret = await getSecret(SECRET_NAME, {
      maxAge: CACHE_MAX_AGE,
      transform: "json",
    });

    const validatedSecret = SecretSchema.parse(rawSecret);

    const jwks: JwksResponse = {
      keys: [
        {
          alg: "RS256",
          e: "AQAB",
          kty: "RSA",
          n: validatedSecret.n,
          use: "sig",
          kid: validatedSecret.kid,
        },
      ],
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jwks),
    };
  } catch (error) {
    console.error("Error fetching or validating JWKS:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
