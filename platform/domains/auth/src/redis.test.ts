import { config, it } from "@flex/testing";
import Redis from "ioredis";
import { beforeEach, describe, expect, vi } from "vitest";

import { createRedisClient } from "./redis";

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

describe("createRedisClient", () => {
  const [endpoint, port] = config.redis.endpoint.value.split(":");

  beforeEach(() => {
    vi.clearAllMocks();

    Object.values(mockRedisInstance).forEach((method) => {
      method.mockReset();
    });
  });

  it("creates Redis client with correct configuration", () => {
    expect.assert(endpoint, "Redis endpoint is missing");
    expect.assert(port, "Redis port is missing");

    const RedisMock = vi.mocked(Redis);

    const client = createRedisClient(endpoint);

    expect(RedisMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        connectTimeout: 5000,
        enableOfflineQueue: true,
        host: endpoint,
        port: Number(port),
        tls: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          checkServerIdentity: expect.any(Function),
        },
      }),
    );

    ["connect", "ready", "error"].forEach((eventName, i) => {
      expect(mockRedisInstance.on).toHaveBeenNthCalledWith(
        ++i,
        eventName,
        expect.any(Function),
      );
    });

    Object.values(client).forEach((method) => {
      expect(typeof method).toBe("function");
    });
  });

  it("creates Redis client with endpoint containing port (port is ignored, always uses 6379)", () => {
    expect.assert(endpoint, "Redis endpoint is missing");

    const RedisMock = vi.mocked(Redis);

    createRedisClient(`${endpoint}:6380`);

    expect(RedisMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        connectTimeout: 5000,
        enableOfflineQueue: true,
        host: `${endpoint}:6380`,
        port: 6379,
        tls: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          checkServerIdentity: expect.any(Function),
        },
      }),
    );
  });

  it("wraps basic Redis commands correctly", async () => {
    const client = createRedisClient(config.redis.endpoint.value);

    mockRedisInstance.get.mockResolvedValueOnce("value");
    mockRedisInstance.set
      .mockResolvedValueOnce("OK")
      .mockResolvedValueOnce("OK");
    mockRedisInstance.del.mockResolvedValueOnce(1);

    const getResult = await client.get("key");
    const setResultWithoutExpiry = await client.set("key", "val");
    const setResultWithExpiry = await client.set("key", "val", 60);
    const delResult = await client.del("key");
    await client.disconnect();

    expect(mockRedisInstance.get).toHaveBeenCalledExactlyOnceWith("key");
    expect(getResult).toBe("value");

    expect(mockRedisInstance.set).toHaveBeenNthCalledWith(1, "key", "val");
    expect(setResultWithoutExpiry).toBe("OK");
    expect(mockRedisInstance.set).toHaveBeenNthCalledWith(
      2,
      "key",
      "val",
      "EX",
      60,
    );
    expect(setResultWithExpiry).toBe("OK");

    expect(mockRedisInstance.del).toHaveBeenCalledWith("key");
    expect(delResult).toBe(1);

    expect(mockRedisInstance.quit).toHaveBeenCalledOnce();
  });
});
