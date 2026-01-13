import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayAuthorizerEvent,
  APIGatewayAuthorizerResult,
  Context,
} from "aws-lambda";

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
  APIGatewayAuthorizerEvent,
  APIGatewayAuthorizerResult
>(
  async (
    event: APIGatewayAuthorizerEvent,
    _context: Context,
  ): Promise<APIGatewayAuthorizerResult> => {
    const client = await getRedisClient();

    // Proof of data in Redis
    const cacheKey = `auth:${1}`;
    await client.set(cacheKey, JSON.stringify({ timestamp: Date.now() }), 300);
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
  },
  {
    logLevel: "INFO",
    serviceName: "auth-authorizer",
  },
);

export { handler };
