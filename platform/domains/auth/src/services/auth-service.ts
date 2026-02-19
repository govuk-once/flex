import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { JwtVerifier } from "aws-jwt-verify";
import { validateCognitoJwtFields } from "aws-jwt-verify/cognito-verifier";
import { FailedAssertionError } from "aws-jwt-verify/error";
import type { APIGatewayTokenAuthorizerEvent } from "aws-lambda";

import { configSchema } from "../config";

function extractToken(event: APIGatewayTokenAuthorizerEvent) {
  return event.authorizationToken.split(" ")[1];
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
    extractPairwiseId: async (event: APIGatewayTokenAuthorizerEvent) => {
      const token = extractToken(event);

      if (!token) {
        throw new FailedAssertionError(
          "Missing authorization token",
          token,
          "authorization token",
        );
      }

      const jwt = await verifier.verify(token);
      const username = jwt.username as string | undefined;

      if (!username) {
        throw new FailedAssertionError(
          "Missing username claim",
          username,
          "username",
        );
      }

      logger.info("JWT verified", { pairwiseId: username });

      return username;
    },
  };
}
