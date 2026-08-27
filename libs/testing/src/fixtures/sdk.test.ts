import { describe, expect, it } from "vitest";

import { buildLambdaContext } from "./lambda";
import { baseSdkEvent, createSdkContext, createSdkEvent } from "./sdk";
import { createUserId, userId } from "./user";

describe("createSdkEvent", () => {
  const endpoint = "/example";
  const sdkEvent = createSdkEvent();

  it("returns the base event when called with no arguments", () => {
    expect(sdkEvent()).toStrictEqual(baseSdkEvent);
  });

  it("merges base event with overrides when provided", () => {
    const event = sdkEvent({
      path: endpoint,
      headers: { "x-custom": "value" },
      requestContext: { authorizer: { pairwiseId: "custom-user" } },
    });

    expect(event.path).toBe(endpoint);
    expect(event.headers).toStrictEqual({
      "Content-Type": "application/json",
      "x-custom": "value",
    });
    expect(event.requestContext.authorizer).toStrictEqual({
      principalId: "test-user-id",
      integrationLatency: 0,
      pairwiseId: "custom-user",
    });
  });

  it.each(["get", "delete"] as const)(
    'variant "%s" sets httpMethod and path',
    (method) => {
      const event = sdkEvent[method](endpoint);

      expect(event.httpMethod).toBe(method.toUpperCase());
      expect(event.path).toBe(endpoint);
    },
  );

  it.each(["post", "put", "patch"] as const)(
    'variant "%s" sets httpMethod, path and body',
    (method) => {
      const event = sdkEvent[method](endpoint, { body: { key: "value" } });

      expect(event.httpMethod).toBe(method.toUpperCase());
      expect(event.path).toBe(endpoint);
      expect(event.body).toBe(JSON.stringify({ key: "value" }));
    },
  );

  it("serialises query parameters when query is provided", () => {
    expect(
      sdkEvent.get(endpoint, { query: { page: 1 } }).queryStringParameters,
    ).toEqual({ page: "1" });
  });

  it("sets event path parameters when params are provided", () => {
    expect(
      sdkEvent.get(endpoint, { params: { id: "test-id" } }).pathParameters,
    ).toStrictEqual({ id: "test-id" });
  });

  it("keeps the default authorizer when auth is not provided", () => {
    expect(sdkEvent.get(endpoint).requestContext.authorizer).toStrictEqual(
      baseSdkEvent.requestContext.authorizer,
    );
  });

  it("creates an authenticated event when a user ID is passed to auth", () => {
    const event = sdkEvent.get(endpoint, { auth: userId });

    expect(event.requestContext.authorizer).toStrictEqual({
      principalId: userId,
      integrationLatency: 0,
      pairwiseId: userId,
    });
  });

  it("creates an unauthenticated event when auth is set to false", () => {
    const event = sdkEvent.get(endpoint, { auth: false });

    expect(event.requestContext.authorizer).toStrictEqual({
      principalId: "",
      integrationLatency: 0,
      pairwiseId: "",
    });
  });
});

describe("createSdkContext", () => {
  const baseContext = buildLambdaContext();
  const sdkContext = createSdkContext();

  it("returns the base context with default user ID when called with no arguments", () => {
    expect(sdkContext()).toStrictEqual({
      ...baseContext,
      userId: "test-user-id",
    });
  });

  it("returns a cloned context with overrides when provided", () => {
    expect(
      sdkContext({ overrides: { functionName: "custom-function" } }),
    ).toMatchObject({ ...baseContext, functionName: "custom-function" });
  });

  it("injects user ID into context when provided", () => {
    expect(sdkContext({ userId: createUserId("custom-user") })).toMatchObject({
      ...baseContext,
      userId: "custom-user",
    });
  });

  it("injects params into context when provided", () => {
    expect(sdkContext({ params: { param: "value" } })).toMatchObject({
      ...baseContext,
      param: "value",
    });
  });

  it("injects secrets into context when provided", () => {
    expect(
      sdkContext({
        secrets: { secret: "value" }, // pragma: allowlist secret
      }),
    ).toMatchObject({
      ...baseContext,
      secret: "value", // pragma: allowlist secret
    });
  });
});
