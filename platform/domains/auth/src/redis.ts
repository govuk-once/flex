import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { Cluster } from "ioredis";
import z from "zod";

export const DEFAULT_REDIS_PORT = 6379;
export const DEFAULT_REDIS_CONNECT_TIMEOUT = 10000;
export const DEFAULT_REDIS_MAX_RETRIES_PER_REQUEST = 3;

/**
 * Redis client interface for dependency injection and testing
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    expirySeconds?: number,
  ): Promise<string | null>;
  del(key: string): Promise<number>;
  disconnect(): Promise<void>;
}

/**
 * Creates a Redis client for ElastiCache cluster mode
 *
 * @param endpoint - The Redis cluster configuration endpoint
 * @returns A Redis client instance configured for cluster mode
 */
function createRedisClient(endpoint: string): RedisClient {
  // For cluster mode, we need to parse the endpoint and create cluster nodes
  // The configuration endpoint format is typically: <cluster-name>.xxxxx.cache.amazonaws.com:6379
  const [host, port] = endpoint.split(":");
  const redisPort = port ? Number.parseInt(port, 10) : DEFAULT_REDIS_PORT;
  if(
    !z.url()
      .safeParse(`redis://${host}`) ||
    !z.number()
      .max(65535)
      .min(0)
      .safeParse(redisPort)
  ){
    throw new Error(`Invalid Redis endpoint format: ${endpoint}`);
  }

  const cluster = new Cluster(
    [
      {
        host,
        port: redisPort,
      },
    ],
    {
      redisOptions: {
        // ElastiCache uses TLS in production, but we'll make it configurable
        // For now, we'll assume TLS is not required (can be configured via env var)
        tls: process.env.REDIS_TLS_ENABLED === "true" ? {} : undefined,
        connectTimeout: DEFAULT_REDIS_CONNECT_TIMEOUT,
        maxRetriesPerRequest: DEFAULT_REDIS_MAX_RETRIES_PER_REQUEST,
      },
      // Cluster-specific options
      enableOfflineQueue: true,
      enableReadyCheck: true,
    },
  );

  return {
    get: async (key: string): Promise<string | null> => {
      const result = await cluster.get(key);
      return result ?? null;
    },
    set: async (
      key: string,
      value: string,
      expirySeconds?: number,
    ): Promise<string | null> => {
      if (expirySeconds) {
        const result = await cluster.set(key, value, "EX", expirySeconds);
        return result ?? null;
      }
      const result = await cluster.set(key, value);
      return result ?? null;
    },
    del: async (key: string): Promise<number> => {
      return await cluster.del(key);
    },
    disconnect: async (): Promise<void> => {
      await cluster.quit();
    },
  };
}

/**
 * Redis clients - reused across Lambda invocations
 */
let redisClientCache: Map<string, RedisClient> = new Map();

/**
 * Gets or creates the Redis client instance
 */
export async function getRedisClient(endpoint: string): Promise<RedisClient> {
  const redisClient = redisClientCache.get(endpoint);
  if (redisClient) {
    return redisClient;
  }

  const newRedisClient = createRedisClient(endpoint);
  redisClientCache.set(endpoint, newRedisClient);

  return newRedisClient;
}
