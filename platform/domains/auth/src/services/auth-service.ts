import { logger } from "@flex/logging";
import { JwtVerifier } from "aws-jwt-verify";
import { validateCognitoJwtFields } from "aws-jwt-verify/cognito-verifier";
import { FailedAssertionError } from "aws-jwt-verify/error";
import type { APIGatewayTokenAuthorizerEvent } from "aws-lambda";
import { z } from "zod";

import { RevocationCache } from "./revocation-cache";

export const configSchema = z.object({
  AWS_REGION: z.string().min(1),
  USERPOOL_ID: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  JWKS_URI: z.url(),
  USERINFO_ENDPOINT: z.url(),
});

export class TokenRevokedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRevokedException";
  }
}

function extractToken(event: APIGatewayTokenAuthorizerEvent) {
  return event.authorizationToken.split(" ")[1];
}

export function createAuthService() {
  const { AWS_REGION, CLIENT_ID, JWKS_URI, USERPOOL_ID, USERINFO_ENDPOINT } =
    configSchema.parse(process.env);

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

  const revocationCache = new RevocationCache();

  async function checkRevocation(token: string, jti: string): Promise<void> {
    if (revocationCache.isValid(jti)) return;

    let response: Response;
    try {
      response = await fetch(USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      logger.error("Cognito userInfo endpoint unreachable", { error });
      throw new TokenRevokedException(
        "Unable to verify token revocation status",
      );
    }

    if (!response.ok) {
      throw new TokenRevokedException("Token has been revoked");
    }

    revocationCache.markValid(jti);
  }

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

      const jti = jwt.jti as string | undefined;
      if (jti) {
        await checkRevocation(token, jti);
      }

      logger.info("JWT verified", { pairwiseId: username });

      return username;
    },
  };
}
