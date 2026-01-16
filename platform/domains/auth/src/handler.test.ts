import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import {
  authorizerEvent,
  authorizerResult,
  config,
  context,
  it,
} from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { handler, resetRedisClient } from "./handler";
import * as jwksModule from "./jwks";
import * as redisModule from "./redis";

// Mock dependencies
vi.mock("@aws-lambda-powertools/parameters/ssm");
vi.mock("./redis");
vi.mock("./jwks");

describe("Authorizer Handler", () => {
  it.beforeEach(({ redis, ssm }) => {
    resetRedisClient(); // Reset singleton between tests

    vi.clearAllMocks();

    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(getParameter)
      .mockReset()
      .mockImplementation((param) => Promise.resolve(ssm.get(param)));
    vi.mocked(redisModule.createRedisClient).mockReturnValue(redis.client);
    vi.mocked(jwksModule.callCognitoJwksEndpoint).mockResolvedValue({
      keys: [],
    });
  });

  describe("SSM parameter handling", () => {
    const invalidValues = [
      { value: null, description: "null" },
      { value: undefined, description: "undefined" },
      { value: 1234, description: "number" },
      { value: true, description: "boolean" },
      { value: {}, description: "object" },
      { value: [], description: "array" },
      { value: "", description: "empty string" },
    ];

    it("throws when user pool ID parameter is missing", async ({ ssm }) => {
      ssm.delete(config.userPoolId.ssm);

      await expect(handler(authorizerEvent, context)).rejects.toThrow(
        "User pool ID parameter not found or invalid",
      );
    });

    it.for(invalidValues)(
      "throws when user pool ID parameter value is $description",
      async ({ value }, { ssm }) => {
        ssm.set({ [config.userPoolId.ssm]: value });

        await expect(handler(authorizerEvent, context)).rejects.toThrow(
          "User pool ID parameter not found or invalid",
        );
      },
    );

    it("throws when Redis endpoint parameter is missing", async ({ ssm }) => {
      ssm.delete(config.redis.endpoint.ssm);

      await expect(handler(authorizerEvent, context)).rejects.toThrow(
        "Redis endpoint parameter not found or invalid",
      );
    });

    it.for(invalidValues)(
      "throws when Redis endpoint parameter value is $description",
      async ({ value }, { ssm }) => {
        ssm.set({ [config.redis.endpoint.ssm]: value });

        await expect(handler(authorizerEvent, context)).rejects.toThrow(
          "Redis endpoint parameter not found or invalid",
        );
      },
    );
  });

  describe("Redis integration", () => {
    it("writes to Redis with TTL and reads the cached value", async ({
      redis,
    }) => {
      const result = await handler(authorizerEvent, context);

      expect(redis.client.get).toHaveBeenCalledExactlyOnceWith("auth:1");
      expect(redis.client.set).toHaveBeenCalledExactlyOnceWith(
        "auth:1",
        expect.stringMatching(/timestamp/),
        300,
      );
      expect(result).toEqual(authorizerResult.allow);
    });

    it("reuses the same Redis client across multiple invocations", async ({
      redis,
    }) => {
      await handler(authorizerEvent, context);
      await handler(authorizerEvent, context);

      // First invocation: 2 calls (user pool ID + Redis endpoint)
      // Second invocation: 1 call (user pool ID only, Redis client is reused)
      expect(getParameter).toHaveBeenCalledTimes(3);
      expect(redisModule.createRedisClient).toHaveBeenCalledTimes(1);
      expect(redis.client.get).toHaveBeenNthCalledWith(2, "auth:1");
      expect(redis.client.set).toHaveBeenNthCalledWith(
        2,
        "auth:1",
        expect.stringMatching(/timestamp/),
        300,
      );
    });

    it.for<"get" | "set">(["get", "set"])(
      'propagates errors when Redis "%s" fails',
      async (method, { redis }) => {
        const message = `${method} failed`;

        redis.client[method].mockRejectedValueOnce(new Error(message));

        await expect(handler(authorizerEvent, context)).rejects.toThrow(
          message,
        );
      },
    );
  });

  describe("JWKS integration", () => {
    it("calls the Cognito JWKS endpoint during authorization", async () => {
      const fetchJwksSpy = vi.spyOn(jwksModule, "callCognitoJwksEndpoint");

      const result = await handler(authorizerEvent, context);

      expect(fetchJwksSpy).toHaveBeenCalledExactlyOnceWith(
        config.userPoolId.value,
        "eu-west-2",
      );
      expect(result).toEqual(authorizerResult.allow);
    });
  });
});
