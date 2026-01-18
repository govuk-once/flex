import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
} from "aws-lambda";

import { getCognitoJwks, getIssuer, Jwks, parseJwks } from "./jwks";
import { getRedisClient, RedisClient } from "./redis";
import { getLogger } from "@flex/logging";
import { verifyJwtSync } from "aws-jwt-verify/jwt-verifier";
import { getConfig } from "./config";

export const COGNITO_JWKS_AUTH_PREFIX = "cognito-auth:";

async function getJwksFromCognitoAndSaveToCache(cache: RedisClient, userPoolId: string, region: string): Promise<Jwks> {
  const logger = getLogger();
  logger.info("Fetching JWKS from Cognito", { userPoolId });
  const jwks = await getCognitoJwks(userPoolId, region);
  try {
    await cache.set(
    `${COGNITO_JWKS_AUTH_PREFIX}${userPoolId}`,
    JSON.stringify(jwks),
    300, // Cache for 5 minutes
  );
    logger.info("JWKS saved to cache", { userPoolId });
  } catch (error) {
    logger.error("Failed to save JWKS to cache", { userPoolId, error });
  }

  return jwks;
}

async function getJwksFromCache(cache: RedisClient, userPoolId: string): Promise<Jwks | null> {
  const logger = getLogger();
  try {
    const cachedJwksString = await cache.get(`${COGNITO_JWKS_AUTH_PREFIX}${userPoolId}`) ?? '';
    if (cachedJwksString) {
      logger.info("JWKS found in cache", { userPoolId });
      const jwk = parseJwks(JSON.parse(cachedJwksString));
      return jwk;
    }
  } catch (error) {
    logger.error("Failed to retrieve JWKS from cache", { userPoolId, error });
  }

  logger.info("JWKS not found in cache", { userPoolId });
  return null;
}

async function getJwks(cache: RedisClient, userPoolId: string, region: string): Promise<Jwks> {
  const cachedJwks = await getJwksFromCache(cache, userPoolId);
  if (cachedJwks) {
    return cachedJwks;
  }

  return getJwksFromCognitoAndSaveToCache(cache, userPoolId, region);
}

/**
 * Lambda authorizer handler for API Gateway HTTP API
 *
 * Reads from and writes to ElastiCache Redis cluster for caching authorization data.
 */
const handler = createLambdaHandler<
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult
>(
  async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
    const logger = getLogger();
    logger.debug("calling auth handler");

    const jwt = event.headers?.authorization?.split(" ")[1];
    if (!jwt) {
      logger.error("No authorization token provided");
      throw new Error("No authorization token provided");
    }

    const config = await getConfig();

    const redisClient = await getRedisClient(config.REDIS_ENDPOINT);
    const jwks = await getJwks(redisClient, config.USERPOOL_ID, config.AWS_REGION);

    verifyJwtSync(jwt, jwks, {
      audience: config.CLIENT_ID,
      issuer: getIssuer(config.AWS_REGION, config.USERPOOL_ID)
    });

    return Promise.resolve({
      principalId: "anonymous",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Allow",
            Resource: "*",
          },
        ],
      },
    });
  },
  {
    serviceName: "auth-authorizer",
  },
);

export { handler };
