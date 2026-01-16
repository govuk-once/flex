import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import type {
  APIGatewayAuthorizerEvent,
  APIGatewayAuthorizerResult,
  Context,
} from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handler, resetRedisClient } from "./handler";
import * as jwksModule from "./jwks";
import * as redisModule from "./redis";

// Mock dependencies
vi.mock("@aws-lambda-powertools/parameters/ssm");
vi.mock("./redis");
vi.mock("./jwks");

// Set environment variables for parameter names
process.env.USER_POOL_ID_PARAMETER_NAME = "/test/auth/user_pool_id";
process.env.REDIS_ENDPOINT_PARAMETER_NAME = "/test/cache/redis/endpoint";

describe("Authorizer Handler", () => {
  const mockContext = {
    getRemainingTimeInMillis: () => 1000,
  } as unknown as Context;

  const mockRedisClient = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    disconnect: vi.fn(),
  };

  const baseEvent: APIGatewayAuthorizerEvent = {
    version: "2.0",
    type: "REQUEST",
    routeArn:
      "arn:aws:execute-api:eu-west-2:123456789012:abcdef123/test/GET/request",
    identitySource: ["Bearer token123"],
    routeKey: "GET /test",
    rawPath: "/test",
    rawQueryString: "",
    headers: {
      authorization: "Bearer token123",
    },
    requestContext: {
      accountId: "123456789012",
      requestId: "test-request-id",
    },
    stageVariables: null,
  } as unknown as APIGatewayAuthorizerEvent;

  const expectedPolicy: APIGatewayAuthorizerResult = {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisClient(); // Reset singleton between tests
    // Mock getParameter to return different values based on parameter name
    vi.mocked(getParameter).mockImplementation((parameterName: string) => {
      if (parameterName === process.env.USER_POOL_ID_PARAMETER_NAME) {
        return Promise.resolve("eu-west-2_testUserPoolId");
      }
      if (parameterName === process.env.REDIS_ENDPOINT_PARAMETER_NAME) {
        return Promise.resolve("redis-endpoint.example.com:6379");
      }
      return Promise.resolve("default-value");
    });
    vi.mocked(redisModule.createRedisClient).mockReturnValue(
      mockRedisClient as unknown as redisModule.RedisClient,
    );
    vi.mocked(jwksModule.callCognitoJwksEndpoint).mockResolvedValue({
      keys: [],
    });
  });

  describe("SSM parameter handling", () => {
    it("throws when user pool ID parameter is missing or invalid (null)", async () => {
      vi.mocked(getParameter).mockImplementation((parameterName: string) => {
        if (parameterName === process.env.USER_POOL_ID_PARAMETER_NAME) {
          return Promise.resolve(null as unknown as string);
        }
        return Promise.resolve("redis-endpoint.example.com:6379");
      });

      await expect(handler(baseEvent, mockContext)).rejects.toThrow(
        "User pool ID parameter not found or invalid",
      );
    });

    it("throws when user pool ID parameter is not a string", async () => {
      vi.mocked(getParameter).mockImplementation((parameterName: string) => {
        if (parameterName === process.env.USER_POOL_ID_PARAMETER_NAME) {
          return Promise.resolve(1234 as unknown as string);
        }
        return Promise.resolve("redis-endpoint.example.com:6379");
      });

      await expect(handler(baseEvent, mockContext)).rejects.toThrow(
        "User pool ID parameter not found or invalid",
      );
    });

    it("throws when Redis endpoint parameter is missing or invalid (null)", async () => {
      // Ensure clean state: reset Redis client singleton and mocks
      resetRedisClient();
      vi.mocked(getParameter).mockReset();
      vi.mocked(getParameter).mockImplementation((parameterName: string) => {
        if (parameterName === process.env.USER_POOL_ID_PARAMETER_NAME) {
          return Promise.resolve("eu-west-2_testUserPoolId");
        }
        if (parameterName === process.env.REDIS_ENDPOINT_PARAMETER_NAME) {
          return Promise.resolve(null as unknown as string);
        }
        return Promise.resolve("default-value");
      });

      await expect(handler(baseEvent, mockContext)).rejects.toThrow(
        "Redis endpoint parameter not found or invalid",
      );
    });

    it("throws when Redis endpoint parameter is not a string", async () => {
      // Ensure clean state: reset Redis client singleton and mocks
      resetRedisClient();
      vi.mocked(getParameter).mockReset();
      vi.mocked(getParameter).mockImplementation((parameterName: string) => {
        if (parameterName === process.env.USER_POOL_ID_PARAMETER_NAME) {
          return Promise.resolve("eu-west-2_testUserPoolId");
        }
        if (parameterName === process.env.REDIS_ENDPOINT_PARAMETER_NAME) {
          return Promise.resolve(1234 as unknown as string);
        }
        return Promise.resolve("default-value");
      });

      await expect(handler(baseEvent, mockContext)).rejects.toThrow(
        "Redis endpoint parameter not found or invalid",
      );
    });
  });

  describe("Redis integration", () => {
    it("reads from Redis when cache key exists", async () => {
      const cachedData = JSON.stringify({ timestamp: Date.now() });
      // Handler calls get twice: once to check if key exists, once at the end
      mockRedisClient.get
        .mockResolvedValueOnce(cachedData) // First call: key exists
        .mockResolvedValueOnce(cachedData); // Second call: get value

      const result = await handler(baseEvent, mockContext);

      // When cache key exists, set should NOT be called
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      // get is called twice: once to check, once to retrieve
      expect(mockRedisClient.get).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.get).toHaveBeenCalledWith("auth:1");
      expect(result).toEqual(expectedPolicy);
    });

    it("writes to Redis when cache key does not exist", async () => {
      const cachedData = JSON.stringify({ timestamp: Date.now() });
      // Handler calls get twice: once to check if key exists, once at the end
      mockRedisClient.get
        .mockResolvedValueOnce(null) // First call: key does not exist
        .mockResolvedValueOnce(cachedData); // Second call: get value after set
      mockRedisClient.set.mockResolvedValue("OK");

      const result = await handler(baseEvent, mockContext);

      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        "auth:1",
        expect.stringContaining('"timestamp"'),
        300,
      );
      // get is called twice: once to check, once to retrieve
      expect(mockRedisClient.get).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.get).toHaveBeenCalledWith("auth:1");
      expect(result).toEqual(expectedPolicy);
    });

    it("reuses the same Redis client across multiple invocations", async () => {
      // Reset call history to ensure accurate counting
      vi.mocked(getParameter).mockClear();
      vi.mocked(redisModule.createRedisClient).mockClear();
      mockRedisClient.get.mockClear();
      mockRedisClient.set.mockClear();

      const cachedData = JSON.stringify({ timestamp: Date.now() });
      // First invocation: key doesn't exist, so set is called
      mockRedisClient.get
        .mockResolvedValueOnce(null) // First get: key doesn't exist
        .mockResolvedValueOnce(cachedData) // Second get: after set
        // Second invocation: key exists (from first invocation), so set is NOT called
        .mockResolvedValueOnce(cachedData) // First get: key exists
        .mockResolvedValueOnce(cachedData); // Second get: get value
      mockRedisClient.set.mockResolvedValue("OK");

      const firstResult = await handler(baseEvent, mockContext);
      const secondResult = await handler(baseEvent, mockContext);

      // First invocation: 2 calls (user pool ID + Redis endpoint)
      // Second invocation: 1 call (user pool ID only, Redis client is reused)
      expect(getParameter).toHaveBeenCalledTimes(3);
      // Redis client is created once and reused
      expect(redisModule.createRedisClient).toHaveBeenCalledTimes(1);
      // First invocation: set is called (key doesn't exist)
      // Second invocation: set is NOT called (key exists from first invocation)
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
      // Each invocation calls get twice: once to check, once to retrieve
      expect(mockRedisClient.get).toHaveBeenCalledTimes(4);
      expect(firstResult).toEqual(expectedPolicy);
      expect(secondResult).toEqual(expectedPolicy);
    });

    it("propagates errors when Redis set fails", async () => {
      // First get returns null (key doesn't exist), so set is called
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.set.mockRejectedValueOnce(new Error("set failed"));

      await expect(handler(baseEvent, mockContext)).rejects.toThrow(
        "set failed",
      );
    });

    it("propagates errors when Redis get fails on first call", async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error("get failed"));

      await expect(handler(baseEvent, mockContext)).rejects.toThrow(
        "get failed",
      );
    });

    it("propagates errors when Redis get fails on second call", async () => {
      const cachedData = JSON.stringify({ timestamp: Date.now() });
      // First get succeeds (key exists), second get fails
      mockRedisClient.get
        .mockResolvedValueOnce(cachedData)
        .mockRejectedValueOnce(new Error("get failed"));

      await expect(handler(baseEvent, mockContext)).rejects.toThrow(
        "get failed",
      );
    });
  });

  describe("JWKS integration", () => {
    it("calls the Cognito JWKS endpoint during authorization", async () => {
      const fetchJwksSpy = vi.mocked(jwksModule.callCognitoJwksEndpoint);
      // Set up Redis mocks so handler can complete
      const cachedData = JSON.stringify({ timestamp: Date.now() });
      mockRedisClient.get
        .mockResolvedValueOnce(null) // First get: key doesn't exist
        .mockResolvedValueOnce(cachedData); // Second get: after set
      mockRedisClient.set.mockResolvedValue("OK");

      const result = await handler(baseEvent, mockContext);

      expect(fetchJwksSpy).toHaveBeenCalledTimes(1);
      expect(fetchJwksSpy).toHaveBeenCalledWith(
        "eu-west-2_testUserPoolId",
        "eu-west-2",
      );
      expect(result).toEqual(expectedPolicy);
    });
  });
});
