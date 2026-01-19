import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEventV2,
} from "aws-lambda";

import { callCognitoJwksEndpoint } from "./jwks";
import { createRedisClient, type RedisClient } from "./redis";

/**
 * Redis client singleton - reused across Lambda invocations
 */
let redisClient: RedisClient | null = null;

/**
 * Gets or creates the Redis client instance
 */
async function getRedisClient(): Promise<RedisClient> {
  if (redisClient) {
    return redisClient;
  }

  const endpoint = await getParameter(
    process.env.REDIS_ENDPOINT_PARAMETER_NAME!, // TODO: add type guard
  );

  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("Redis endpoint parameter not found or invalid");
  }

  redisClient = createRedisClient(endpoint);
  return redisClient;
}

/**
 * Resets the Redis client singleton (for testing purposes)
 */
export function resetRedisClient(): void {
  redisClient = null;
}

/**
 * Lambda authorizer handler for API Gateway HTTP API
 *
 * Reads from and writes to ElastiCache Redis cluster for caching authorization data.
 */
const handler = createLambdaHandler<
  APIGatewayRequestAuthorizerEventV2,
  APIGatewayAuthorizerResult
>(
  async (): Promise<APIGatewayAuthorizerResult> => {
    try {
      const userPoolId = await getParameter(
        process.env.USER_POOL_ID_PARAMETER_NAME!, // TODO: add type guard
      );

      if (!userPoolId || typeof userPoolId !== "string") {
        throw new Error("User pool ID parameter not found or invalid");
      }

      // Demonstrate the ability to call out to a public JWKS endpoint.
      // In a real implementation this would be a configurable JWKS URL
      // for the upstream identity provider.
      const jwks = await callCognitoJwksEndpoint(userPoolId, "eu-west-2");
      console.log("Fetched Cognito JWKS", { jwks });

      // Proof of data in Redis
      const client = await getRedisClient();
      const cacheKey = `auth:${1}`;
      if (await client.get(cacheKey)) {
        console.log("Cache key already exists", { cacheKey });
      } else {
        await client.set(
          cacheKey,
          JSON.stringify({ timestamp: Date.now() }),
          300,
        );
      }
      console.log("Set cache key", { cacheKey });
      const cachedValue = await client.get(cacheKey);
      console.log("Authorizer handler", { cachedValue });

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
    } catch (error) {
      console.error("Authorizer handler error", { error });
      throw error;
    }
  },
  {
    logLevel: "INFO",
    serviceName: "auth-authorizer",
  },
);

export { handler };
