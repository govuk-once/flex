import Redis from "ioredis";

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
export function createRedisClient(endpoint: string): RedisClient {
  // For cluster mode, we need to parse the endpoint and create cluster nodes
  // The configuration endpoint format is typically: <cluster-name>.xxxxx.cache.amazonaws.com:6379
  // Create a cluster client for ElastiCache cluster mode
  const redis = new Redis({
    // Ensure 'endpoint' is the Primary Endpoint from CDK (attrPrimaryEndPointAddress)
    // NOT the Configuration Endpoint (which doesn't exist for this mode)
    host: endpoint,
    port: 6379,

    tls: {
      checkServerIdentity: () => undefined,
    },

    // Standard options for High Availability
    connectTimeout: 5000,
    enableOfflineQueue: true,
  });

  redis.on("connect", () => console.log("Redis: Connection established"));
  redis.on("ready", () => console.log("Redis: Client is ready"));
  redis.on("error", (err) => {
    console.error("Redis Error:", err.message);
  });

  return {
    get: async (key: string): Promise<string | null> => {
      const result = await redis.get(key);
      return result ?? null;
    },
    set: async (
      key: string,
      value: string,
      expirySeconds?: number,
    ): Promise<string | null> => {
      if (expirySeconds) {
        const result = await redis.set(key, value, "EX", expirySeconds);
        return result ?? null;
      }
      const result = await redis.set(key, value);
      return result ?? null;
    },
    del: async (key: string): Promise<number> => {
      return await redis.del(key);
    },
    disconnect: async (): Promise<void> => {
      await redis.quit();
    },
  };
}
