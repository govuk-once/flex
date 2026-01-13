import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import type { APIGatewayAuthorizerEvent, Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handler, resetRedisClient } from "./handler";
import * as redisModule from "./redis";

// Mock dependencies
vi.mock("@aws-lambda-powertools/parameters/ssm");
vi.mock("./redis");

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

  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisClient(); // Reset singleton between tests
    vi.mocked(getParameter).mockResolvedValue("redis-endpoint.example.com:6379");
    vi.mocked(redisModule.createRedisClient).mockReturnValue(
      mockRedisClient as unknown as redisModule.RedisClient,
    );
  });

  describe("Redis integration", () => {
    it("reads from Redis when cache key exists", async () => {
      const cachedData = JSON.stringify({ timestamp: Date.now() });
      mockRedisClient.get.mockResolvedValue(cachedData);

      const event = {
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

      const result = await handler(event, mockContext);

      expect(mockRedisClient.get).toHaveBeenCalledWith(
        "auth:1",
      );
      expect(result).toEqual({
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
    });

    it("writes to Redis when cache key does not exist", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue("OK");

      const event = {
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
          requestId: "test-request-id-2",
        },
        stageVariables: null,
      } as unknown as APIGatewayAuthorizerEvent;

      const result = await handler(event, mockContext);

      expect(mockRedisClient.get).toHaveBeenCalledWith(
        "auth:1",
      );
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        "auth:1",
        expect.stringContaining('"timestamp"'),
        300,
      );
      expect(result).toEqual({
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
    });

  });
});
