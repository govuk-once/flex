import { config, it } from "@flex/testing";
import { Cluster } from "ioredis";
import { beforeEach, describe, expect, vi } from "vitest";

import { createRedisClient } from "./redis";

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

const mockClusterInstance = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  quit: vi.fn(),
};

describe("createRedisClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.values(mockClusterInstance).forEach((method) => {
      method.mockReset();
    });
  });

  it.afterEach(({ env }) => {
    env.delete(config.redis.tls.env);
  });

  it("parses endpoint and uses default port when none is provided", () => {
    const [endpoint, port] = config.redis.endpoint.value.split(":");

    expect.assert(endpoint, "Endpoint is missing");
    expect.assert(port, "Port is missing");

    const client = createRedisClient(endpoint);

    const ClusterMock = vi.mocked(Cluster);

    const [startupNodes, options] = ClusterMock.mock.lastCall!;

    expect(startupNodes).toEqual([{ host: endpoint, port: Number(port) }]);
    expect(options).toMatchObject({
      redisOptions: {
        connectTimeout: 10000,
        maxRetriesPerRequest: 3,
        tls: undefined,
      },
      enableOfflineQueue: true,
      enableReadyCheck: true,
    });

    // Sanity check that returned client has expected shape
    Object.values(client).forEach((method) => {
      expect(typeof method).toBe("function");
    });
  });

  it("parses endpoint with explicit port", () => {
    createRedisClient(config.redis.endpoint.value);

    const [endpoint, port] = config.redis.endpoint.value.split(":");

    expect.assert(endpoint, "Endpoint is missing");
    expect.assert(port, "Port is missing");

    const ClusterMock = vi.mocked(Cluster);

    const [startupNodes, options] = ClusterMock.mock.lastCall!;

    expect(ClusterMock).toHaveBeenCalledOnce();
    expect(startupNodes).toEqual([{ host: endpoint, port: Number(port) }]);
    expect(options).toMatchObject(expect.any(Object));
  });

  it("enables TLS when REDIS_TLS_ENABLED is set to 'true'", ({ env }) => {
    env.set({ [config.redis.tls.env]: "true" });

    createRedisClient(config.redis.endpoint.value);

    const ClusterMock = vi.mocked(Cluster);

    const [startupNodes, options] = ClusterMock.mock.lastCall!;

    expect(ClusterMock).toHaveBeenCalledOnce();
    expect(startupNodes).toEqual(expect.any(Array));
    expect(options).toMatchObject({
      redisOptions: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tls: expect.any(Object),
      },
    });
  });

  it("wraps basic Redis commands correctly", async () => {
    const client = createRedisClient(config.redis.endpoint.value);

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

    expect(mockClusterInstance.quit).toHaveBeenCalledOnce();
  });
});
