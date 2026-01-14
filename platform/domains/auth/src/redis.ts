import { Cluster } from "ioredis";

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
  const [host, port] = endpoint.split(":");
  const redisPort = port ? Number.parseInt(port, 10) : 6379;

  // Create a cluster client for ElastiCache cluster mode
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
        connectTimeout: 10000,
        maxRetriesPerRequest: 3,
      },
      // Cluster-specific options
      enableOfflineQueue: true, // Changed from false to true
      // Wait for cluster to be ready before allowing commands
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
