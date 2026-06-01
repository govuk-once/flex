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

  it("returns the base event when called with no arguments", () => {
    expect(sdkEvent()).toStrictEqual(baseSdkEvent);
  });

  it("merges base event with overrides when provided", () => {
    const event = sdkEvent({
      path: "/new",
      headers: { "x-custom": "value" },
      requestContext: { authorizer: { pairwiseId: "custom-user" } },
    });

    expect(event.path).toBe("/new");
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
      const event = sdkEvent[method]("/method");

      expect(event.httpMethod).toBe(method.toUpperCase());
      expect(event.path).toBe("/method");
    },
  );

  it.each(["post", "put", "patch"] as const)(
    'variant "%s" sets httpMethod, path and body',
    (method) => {
      const event = sdkEvent[method]("/method", { body: { key: "value" } });

      expect(event.httpMethod).toBe(method.toUpperCase());
      expect(event.path).toBe("/method");
      expect(event.body).toBe(JSON.stringify({ key: "value" }));
    },
  );

  it("serialises query parameters", () => {
    expect(
      sdkEvent.get("/", { query: { page: 1 } }).queryStringParameters,
    ).toEqual({ page: "1" });
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
