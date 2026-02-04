import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { JwtVerifier } from "aws-jwt-verify";
import { validateCognitoJwtFields } from "aws-jwt-verify/cognito-verifier";
import type { APIGatewayRequestAuthorizerEventV2 } from "aws-lambda";
import createHttpError from "http-errors";

import { configSchema } from "../config";

function extractToken(event: APIGatewayRequestAuthorizerEventV2) {
  return event.headers?.authorization?.split(" ")[1];
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
        throw new createHttpError.Unauthorized("Missing authorization token");
      }

      const jwt = await verifier.verify(token);
      const username = jwt.username as string | undefined;

      if (!username) {
        throw new createHttpError.Unauthorized("JWT missing username claim");
      }

      logger.info("JWT verified", { pairwiseId: username });

      return username;
    },
  };
}
