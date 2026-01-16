import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
};

vi.mock("ioredis", () => {
  const RedisMock = vi.fn(function Redis() {
    return mockRedisInstance as unknown as {
      get: (key: string) => Promise<string | null>;
      set: (
        key: string,
        value: string,
        ...args: unknown[]
      ) => Promise<string | null>;
      del: (key: string) => Promise<number>;
      quit: () => Promise<void>;
      on: (event: string, callback: () => void) => void;
    };
  });

  return {
    default: RedisMock,
  };
});

import Redis from "ioredis";

import { createRedisClient } from "./redis";

describe("createRedisClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisInstance.get.mockReset();
    mockRedisInstance.set.mockReset();
    mockRedisInstance.del.mockReset();
    mockRedisInstance.quit.mockReset();
    mockRedisInstance.on.mockReset();
  });

  afterEach(() => {
    delete process.env.REDIS_TLS_ENABLED;
  });

  it("creates Redis client with correct configuration", () => {
    const client = createRedisClient("example.cache.amazonaws.com");

    const RedisMock = vi.mocked(Redis);
    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(RedisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "example.cache.amazonaws.com",
        port: 6379,
        connectTimeout: 5000,
        enableOfflineQueue: true,
      }),
    );

    // Verify TLS configuration
    const calls = RedisMock.mock.calls as unknown as Array<
      [
        {
          host: string;
          port: number;
          tls?: { checkServerIdentity?: () => undefined };
          connectTimeout: number;
          enableOfflineQueue: boolean;
        },
      ]
    >;
    expect(calls.length).toBeGreaterThan(0);
    const config = calls[0]?.[0];
    expect(config).toBeDefined();
    if (config) {
      expect(config.tls).toBeDefined();
      expect(typeof config.tls?.checkServerIdentity).toBe("function");
    }

    // Verify event listeners are set up
    expect(mockRedisInstance.on).toHaveBeenCalledWith(
      "connect",
      expect.any(Function) as () => void,
    );
    expect(mockRedisInstance.on).toHaveBeenCalledWith(
      "ready",
      expect.any(Function) as () => void,
    );
    expect(mockRedisInstance.on).toHaveBeenCalledWith(
      "error",
      expect.any(Function) as (err: Error) => void,
    );

    // Sanity check that returned client has expected shape
    expect(typeof client.get).toBe("function");
    expect(typeof client.set).toBe("function");
    expect(typeof client.del).toBe("function");
    expect(typeof client.disconnect).toBe("function");
  });

  it("creates Redis client with endpoint containing port (port is ignored, always uses 6379)", () => {
    createRedisClient("example.cache.amazonaws.com:6380");

    const RedisMock = vi.mocked(Redis);
    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(RedisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "example.cache.amazonaws.com:6380",
        port: 6379,
        connectTimeout: 5000,
        enableOfflineQueue: true,
      }),
    );

    // Verify TLS configuration
    const calls = RedisMock.mock.calls as unknown as Array<
      [
        {
          host: string;
          port: number;
          tls?: { checkServerIdentity?: () => undefined };
          connectTimeout: number;
          enableOfflineQueue: boolean;
        },
      ]
    >;
    expect(calls.length).toBeGreaterThan(0);
    const config = calls[0]?.[0];
    expect(config).toBeDefined();
    if (config) {
      expect(config.tls).toBeDefined();
      expect(typeof config.tls?.checkServerIdentity).toBe("function");
    }
  });

  it("wraps basic Redis commands correctly", async () => {
    const client = createRedisClient("example.cache.amazonaws.com:6379");

    mockRedisInstance.get.mockResolvedValueOnce("value");
    const getResult = await client.get("key");
    expect(mockRedisInstance.get).toHaveBeenCalledWith("key");
    expect(getResult).toBe("value");

    mockRedisInstance.set.mockResolvedValueOnce("OK");
    const setResultWithoutExpiry = await client.set("key", "val");
    expect(mockRedisInstance.set).toHaveBeenCalledWith("key", "val");
    expect(setResultWithoutExpiry).toBe("OK");

    mockRedisInstance.set.mockResolvedValueOnce("OK");
    const setResultWithExpiry = await client.set("key", "val", 60);
    expect(mockRedisInstance.set).toHaveBeenCalledWith("key", "val", "EX", 60);
    expect(setResultWithExpiry).toBe("OK");

    mockRedisInstance.del.mockResolvedValueOnce(1);
    const delResult = await client.del("key");
    expect(mockRedisInstance.del).toHaveBeenCalledWith("key");
    expect(delResult).toBe(1);

    await client.disconnect();
    expect(mockRedisInstance.quit).toHaveBeenCalledTimes(1);
  });
});
