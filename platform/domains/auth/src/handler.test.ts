import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { authorizerEvent, config, context, it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { handler, resetRedisClient } from "./handler";
import * as jwksModule from "./jwks";
import * as redisModule from "./redis";

vi.mock("@aws-lambda-powertools/parameters/ssm");
vi.mock("./redis");
vi.mock("./jwks");

describe("Authorizer Handler", () => {
  it.beforeEach(({ redis, ssm }) => {
    resetRedisClient(); // Reset singleton between tests

    vi.clearAllMocks();

    vi.spyOn(console, "log").mockImplementation(() => {});
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
    const pairwiseId = "test-pairwise-id";
    const cached = JSON.stringify({ timestamp: Date.now() });

    it("reads from Redis when cache key exists", async ({
      authorizerResult,
      redis,
    }) => {
      // redis `get` is called twice: once to check if key exists, once at the end
      redis.client.get
        .mockResolvedValueOnce(cached) // call #1: key exists
        .mockResolvedValueOnce(cached); // call #2: get value

      const result = await handler(authorizerEvent, context);

      // When cache key exists, set should NOT be called
      expect(redis.client.set).not.toHaveBeenCalled();
      // get is called twice: once to check, once to retrieve
      expect(redis.client.get).toHaveBeenNthCalledWith(2, "auth:1");
      expect(result).toEqual(authorizerResult.allowWithPairwiseId(pairwiseId));
    });

    it("writes to Redis with TTL when cache key does not exist", async ({
      authorizerResult,
      redis,
    }) => {
      // Handler calls get twice: once to check if key exists, once at the end
      redis.client.get
        .mockResolvedValueOnce(null) // call #1: key does not exist
        .mockResolvedValueOnce(cached); // call #2: get value after set
      redis.client.set.mockResolvedValue("OK");

      const result = await handler(authorizerEvent, context);

      expect(redis.client.set).toHaveBeenCalledExactlyOnceWith(
        "auth:1",
        expect.stringMatching(/timestamp/),
        300,
      );
      // get is called twice: once to check, once to retrieve
      expect(redis.client.get).toHaveBeenNthCalledWith(2, "auth:1");
      expect(result).toEqual(authorizerResult.allowWithPairwiseId(pairwiseId));
    });

    it("reuses the same Redis client across multiple invocations", async ({
      authorizerResult,
      redis,
    }) => {
      // invocation #1: key doesn't exist, so set is called
      redis.client.get
        .mockResolvedValueOnce(null) // call #1: key doesn't exist
        .mockResolvedValueOnce(cached) // call #2: after `set`
        // invocation #2: key exists, no need to invoke `set`
        .mockResolvedValueOnce(cached) // call #3: key exists
        .mockResolvedValueOnce(cached); // call #4: get value
      redis.client.set.mockResolvedValue("OK");

      // invocation #1: 2 SSM calls (user pool ID + Redis endpoint, instance created for all subsequent calls)
      const firstResult = await handler(authorizerEvent, context);
      // invocation #2: 1 SSM call (user pool ID only, reuse existing Redis client)
      const secondResult = await handler(authorizerEvent, context);

      expect(getParameter).toHaveBeenCalledTimes(3);
      expect(redisModule.createRedisClient).toHaveBeenCalledOnce();
      expect(redis.client.get).toHaveBeenCalledTimes(4);
      expect(redis.client.get).toHaveBeenCalledWith("auth:1");
      expect(redis.client.set).toHaveBeenCalledExactlyOnceWith(
        "auth:1",
        expect.stringMatching(/timestamp/),
        300,
      );
      expect(firstResult).toEqual(
        authorizerResult.allowWithPairwiseId(pairwiseId),
      );
      expect(secondResult).toEqual(
        authorizerResult.allowWithPairwiseId(pairwiseId),
      );
    });

    it.for(["get", "set"] as const)(
      'propagates errors when Redis "%s" fails',
      async (method, { redis }) => {
        const message = `${method} failed`;

        if (method === "set") redis.client.get.mockResolvedValueOnce(null);
        redis.client[method].mockRejectedValueOnce(new Error(message));

        await expect(handler(authorizerEvent, context)).rejects.toThrow(
          message,
        );
      },
    );

    it("propagates errors when Redis get fails on second call", async ({
      redis,
    }) => {
      redis.client.get
        .mockResolvedValueOnce(cached)
        .mockRejectedValueOnce(new Error("get failed"));

      await expect(handler(authorizerEvent, context)).rejects.toThrow(
        "get failed",
      );
    });
  });

  describe("JWKS integration", () => {
    it("calls the Cognito JWKS endpoint when user pool ID is defined", async () => {
      const fetchJwksSpy = vi.mocked(jwksModule.callCognitoJwksEndpoint);

      await handler(authorizerEvent, context);

      expect(fetchJwksSpy).toHaveBeenCalledExactlyOnceWith(
        config.userPoolId.value,
        "eu-west-2",
      );
    });
  });
});
