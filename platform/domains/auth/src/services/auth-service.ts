import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { JwtVerifier } from "aws-jwt-verify";
import { validateCognitoJwtFields } from "aws-jwt-verify/cognito-verifier";
import type { APIGatewayRequestAuthorizerEventV2 } from "aws-lambda";

import { configSchema } from "../config";
import { JwtValidationError } from "../errors";

function extractToken(event: APIGatewayRequestAuthorizerEventV2) {
  return event.headers?.authorization?.split(" ")[1];
}

/**
 * Determines if an error from verifier.verify is a JWT validation failure (Deny)
 * rather than an infrastructure failure like JWKS fetch error (500).
 */
function isJwtValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  const indicators = [
    "fetch",
    "econnrefused",
    "enotfound",
    "etimedout",
    "network",
    "failed to fetch",
  ];
  return !indicators.some((ind) => msg.includes(ind));
}

export async function createAuthService() {
  const logger = getLogger();
  const { AWS_REGION, CLIENT_ID, JWKS_URI, USERPOOL_ID } =
    await getConfig(configSchema);

  const verifier = JwtVerifier.create({
    issuer: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USERPOOL_ID}`,
    jwksUri: JWKS_URI,
    audience: null,
    customJwtCheck: ({ payload }) => {
      validateCognitoJwtFields(payload, {
        tokenUse: "access",
        clientId: CLIENT_ID,
      });
    },
  });

  return {
    extractPairwiseId: async (event: APIGatewayRequestAuthorizerEventV2) => {
      const token = extractToken(event);

      if (!token) {
        throw new JwtValidationError("Missing authorization token");
      }

      try {
        const jwt = await verifier.verify(token);
        const username = jwt.username as string | undefined;

        if (!username) {
          throw new JwtValidationError("JWT missing username claim");
        }

        logger.info("JWT verified", { pairwiseId: username });

        return username;
      } catch (error) {
        if (isJwtValidationError(error)) {
          throw new JwtValidationError(
            error instanceof Error ? error.message : "Invalid JWT",
          );
        }
        throw error;
      }
    },
  };
}
