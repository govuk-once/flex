import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { Jwk } from "aws-jwt-verify/jwk";
import type { APIGatewayProxyResultV2 } from "aws-lambda";

const ssm = new SSMClient();

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
  try {
    const command = new GetParameterCommand({
      Name: "/development/auth/e2e/private_jwk",
      WithDecryption: true,
    });

    const response = await ssm.send(command);

    if (!response.Parameter?.Value) {
      throw new Error("JWK not found in Parameter Store");
    }

    const fullKey = JSON.parse(response.Parameter.Value) as Jwk;

    const jwks = {
      keys: [
        {
          alg: "RS256",
          e: "AQAB",
          kty: "RSA",
          n: fullKey.n,
          use: "sig",
          kid: fullKey.kid,
        },
      ],
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jwks),
    };
  } catch (error) {
    console.error("Error fetching JWKS:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
