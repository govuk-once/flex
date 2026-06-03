import { describe, expect, it } from "vitest";

import {
  baseSdkContext,
  baseSdkEvent,
  createSdkContext,
  createSdkEvent,
} from "./sdk";
import { createUserId } from "./user";

describe("createSdkEvent", () => {
  const sdkEvent = createSdkEvent();
  const userId = createUserId("custom-user");

  it("returns the base event when called with no arguments", () => {
    expect(sdkEvent()).toStrictEqual(baseSdkEvent);
  });

  it("merges base event with overrides when provided", () => {
    const event = sdkEvent({
      path: "/test",
      headers: { "x-custom": "value" },
      requestContext: { authorizer: { pairwiseId: "custom-user" } },
    });

    expect(event.path).toBe("/test");
    expect(event.headers).toStrictEqual({
      "Content-Type": "application/json",
      "x-custom": "value",
    });
    expect(event.requestContext.authorizer).toStrictEqual({
      principalId: "test-pairwise-id",
      integrationLatency: 0,
      pairwiseId: "custom-user",
    });
  });

  it.each(["get", "delete"] as const)(
    'variant "%s" sets httpMethod and path',
    (method) => {
      const event = sdkEvent[method]("/test");

      expect(event.httpMethod).toBe(method.toUpperCase());
      expect(event.path).toBe("/test");
    },
  );

  it.each(["post", "put", "patch"] as const)(
    'variant "%s" sets httpMethod, path and body',
    (method) => {
      const event = sdkEvent[method]("/test", { body: { key: "value" } });

      expect(event.httpMethod).toBe(method.toUpperCase());
      expect(event.path).toBe("/test");
      expect(event.body).toBe(JSON.stringify({ key: "value" }));
    },
  );

  it("serialises query parameters when query is provided", () => {
    expect(
      sdkEvent.get("/test", { query: { page: 1 } }).queryStringParameters,
    ).toEqual({ page: "1" });
  });

  it("sets event path parameters when params are provided", () => {
    expect(
      sdkEvent.get("/test", { params: { id: "test-id" } }).pathParameters,
    ).toStrictEqual({ id: "test-id" });
  });

  it("creates authenticated event when user ID is provided", () => {
    const event = sdkEvent.get("/test", { userId });

    expect(event.requestContext.authorizer).toStrictEqual({
      principalId: userId,
      integrationLatency: 0,
      pairwiseId: userId,
    });
  });

  it("keeps the default authorizer when user ID is not provided", () => {
    expect(sdkEvent.get("/test").requestContext.authorizer).toStrictEqual(
      baseSdkEvent.requestContext.authorizer,
    );
  });
});

describe("createSdkContext", () => {
  const sdkContext = createSdkContext();

  it("returns the base context with default user ID when called with no arguments", () => {
    expect(sdkContext()).toStrictEqual({
      ...baseSdkContext,
      userId: "test-user-id",
    });
  });

  it("returns a cloned context with overrides when provided", () => {
    expect(
      sdkContext({
        overrides: { functionName: "custom-function" },
      }),
    ).toMatchObject({ ...baseSdkContext, functionName: "custom-function" });
  });

  it("injects user ID into context when provided", () => {
    expect(sdkContext({ userId: createUserId("custom-user") })).toMatchObject({
      ...baseSdkContext,
      userId: "custom-user",
    });
  });

  it("injects params into context when provided", () => {
    expect(sdkContext({ params: { param: "value" } })).toMatchObject({
      ...baseSdkContext,
      param: "value",
    });
  });

  it("injects secrets into context when provided", () => {
    expect(
      sdkContext({
        secrets: { secret: "value" }, // pragma: allowlist secret
      }),
    ).toMatchObject({
      ...baseSdkContext,
      secret: "value", // pragma: allowlist secret
    });
  });
});
