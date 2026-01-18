import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Cluster } from "ioredis";

import { getRedisClient } from "./redis";

const mockClusterInstance = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  quit: vi.fn(),
};

vi.mock("ioredis", () => {
  const ClusterMock = vi.fn(function Cluster() {
    return mockClusterInstance as unknown as {
      get: (key: string) => Promise<string | null>;
      set: (
        key: string,
        value: string,
        ...args: unknown[]
      ) => Promise<string | null>;
      del: (key: string) => Promise<number>;
      quit: () => Promise<void>;
    };
  });

  return {
    Cluster: ClusterMock,
  };
});

describe("getRedisClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete process.env.REDIS_TLS_ENABLED;
  });

  describe("Redis client creation", () => {
    it("parses endpoint and uses default port 6379 when none is provided", async () => {
      const client = await getRedisClient("example.cache.amazonaws.com");

      expect(Cluster).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            port: 6379,
          }),
        ],
        expect.anything(),
      );
    });

    it("parses endpoint with explicit port", async () => {
      await getRedisClient("example.cache.amazonaws.com:6380");

      const ClusterMock = vi.mocked(Cluster);
      expect(ClusterMock).toHaveBeenCalledWith(
        [
          {
            host: "example.cache.amazonaws.com",
            port: 6380,
          },
        ],
        expect.anything(),
      );
    });

    it("instantiates Redis client with a number of default options", async () => {
      await getRedisClient("example1.cache.amazonaws.com");

      expect(Cluster).toHaveBeenCalledWith(
        [
          expect.anything(),
        ],
        expect.objectContaining({
          redisOptions: expect.objectContaining({
            tls: undefined,
            connectTimeout: 10000,
            maxRetriesPerRequest: 3,
          }),
          enableOfflineQueue: true,
          enableReadyCheck: true,
        }),
      );
    });



    it("enables TLS when REDIS_TLS_ENABLED is set to 'true'", () => {
      process.env.REDIS_TLS_ENABLED = "true";

      getRedisClient("example.cache.amazonaws.com:6379");

      const ClusterMock = vi.mocked(Cluster);
      expect(ClusterMock).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          redisOptions: expect.objectContaining({
            tls: expect.objectContaining({}) as unknown,
          }) as unknown,
        }) as unknown,
      );
    });
  });

  describe("Redis client command wrappers", () => {

    it("wraps basic Redis commands correctly", async () => {
      const client = await getRedisClient("example.cache.amazonaws.com:6379");

      mockClusterInstance.get.mockResolvedValueOnce("value");
      const getResult = await client.get("key");
      expect(mockClusterInstance.get).toHaveBeenCalledWith("key");
      expect(getResult).toBe("value");

      mockClusterInstance.set.mockResolvedValueOnce("OK");
      const setResultWithoutExpiry = await client.set("key", "val");
      expect(mockClusterInstance.set).toHaveBeenCalledWith("key", "val");
      expect(setResultWithoutExpiry).toBe("OK");

      mockClusterInstance.set.mockResolvedValueOnce("OK");
      const setResultWithExpiry = await client.set("key", "val", 60);
      expect(mockClusterInstance.set).toHaveBeenCalledWith(
        "key",
        "val",
        "EX",
        60,
      );
      expect(setResultWithExpiry).toBe("OK");

      mockClusterInstance.del.mockResolvedValueOnce(1);
      const delResult = await client.del("key");
      expect(mockClusterInstance.del).toHaveBeenCalledWith("key");
      expect(delResult).toBe(1);

      await client.disconnect();
      expect(mockClusterInstance.quit).toHaveBeenCalledTimes(1);
    });
  });
});
