import { logger } from "@flex/logging";
import { it } from "@flex/testing";
import { describe, expect, vi } from "vitest";
import z from "zod";

import { RequestBodyParseError } from "../utils/errors";
import type { BuildContextOptions } from "./build-context";
import { buildHandlerContext } from "./build-context";

vi.mock("@flex/logging", () => {
  const logger = {
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  };
  return {
    logger: vi.fn(() => logger),
  };
});

describe("buildHandlerContext", () => {
  const contextOptions: BuildContextOptions = {
    gateway: "private",
    logger: logger(),
  };

  describe("Logger", () => {
    it("includes a logger in the context", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create(),
        context.create(),
        { ...contextOptions, gateway: "public" },
      );

      expect(store.logger).toBe(logger());
    });
  });

  describe("Auth", () => {
    it("includes auth in the context when gateway is public", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.authenticated(),
        context.create(),
        { ...contextOptions, gateway: "public" },
      );

      expect(store.auth).toStrictEqual({
        pairwiseId: "test-pairwise-id",
      });
    });

    it("omits auth from the context when gateway is private", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.authenticated(),
        context.create(),
        { ...contextOptions, gateway: "private" },
      );

      expect(store.auth).toBeUndefined();
    });

    it("throws when pairwise ID is missing from the authorizer context", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      expect(() =>
        buildHandlerContext(
          privateGatewayEventWithAuthorizer.unauthenticated(),
          context.create(),
          { ...contextOptions, gateway: "public" },
        ),
      ).toThrow("Pairwise ID not found");
    });
  });

  describe("Request Body", () => {
    const endpoint = "/v1/endpoint";
    const body = { key: "value" };
    const schema = z.object({ key: z.literal("value") });

    it("parses and includes the request body in the context when a body schema is provided", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.post(endpoint, { body }),
        context.create(),
        { ...contextOptions, bodySchema: schema },
      );

      expect(store.body).toStrictEqual({ key: "value" });
    });

    it("omits body from the context when no schema is provided", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.post(endpoint, { body }),
        context.create(),
        contextOptions,
      );

      expect(store.body).toBeUndefined();
    });

    it("throws when the request body fails to parse", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      expect(() =>
        buildHandlerContext(
          privateGatewayEventWithAuthorizer.post(endpoint, {
            body: { key: "invalid" },
          }),
          context.create(),
          { ...contextOptions, bodySchema: schema },
        ),
      ).toThrow(RequestBodyParseError);
    });
  });

  describe("Path Parameters", () => {
    it("includes path params in the context when the event contains at least one path parameter", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create({
          pathParameters: { key: "value" },
        }),
        context.create(),
        contextOptions,
      );

      expect(store.pathParams).toStrictEqual({ key: "value" });
    });

    it("omits path params from the context when the event has no path parameters", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create({ pathParameters: {} }),
        context.create(),
        contextOptions,
      );

      expect(store.pathParams).toBeUndefined();
    });
  });

  describe("Query Parameters", () => {
    const queryStringParameters = { key: "value" };

    it("parses and includes query params in the context when a query schema is provided", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const schema = z.object({ key: z.literal("value") });

      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create({ queryStringParameters }),
        context.create(),
        { ...contextOptions, querySchema: schema },
      );

      expect(store.queryParams).toStrictEqual({ key: "value" });
    });

    it("omits query params from the context when a query schema is not provided", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create({ queryStringParameters }),
        context.create(),
        contextOptions,
      );

      expect(store.queryParams).toBeUndefined();
    });
  });

  describe("Resources", () => {
    it("resolves resources from the environment variables", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const resources = {
        testKey: { type: "kms" as const, value: "test-key-value" },
        testParam: { type: "ssm" as const, value: "test-param-value" },
      };

      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create(),
        context.create(),
        { ...contextOptions, resources },
      );

      expect(store.resources).toStrictEqual({
        testKey: "test-key-value",
        testParam: "test-param-value",
      });
    });

    it("resolves resources from the Lambda context", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const resources = {
        testKey: { type: "kms" as const, value: "test-key-value" },
        testParam: { type: "ssm" as const, value: "test-param-value" },
        testSecret: { type: "secret" as const, value: "test-secret-name" },
      };

      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create(),
        context.withSecret({ testSecret: "test-secret-value" }).create(), // pragma: allowlist secret
        { ...contextOptions, resources },
      );

      expect(store.resources).toStrictEqual({
        testKey: "test-key-value",
        testParam: "test-param-value",
        testSecret: "test-secret-value", // pragma: allowlist secret
      });
    });

    it("throws when a resource has not been resolved by middleware", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const resources = {
        testSecret: { type: "secret" as const, value: "test-secret-name" },
      };

      expect(() =>
        buildHandlerContext(
          privateGatewayEventWithAuthorizer.create(),
          context.create(),
          { ...contextOptions, resources },
        ),
      ).toThrow(
        '"testSecret" (secret) resource was not resolved by middleware',
      );
    });

    it("omits resources from the context when the route does not reference any domain resources", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create(),
        context.create(),
        contextOptions,
      );

      expect(store.resources).toBeUndefined();
    });
  });

  describe("Headers", () => {
    it("resolves and includes headers in the context when at least one header is provided", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const headers = {
        required: { name: "x-required", required: true },
        optional: { name: "x-optional", required: false },
      };

      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create({
          headers: { "x-required": "header-value" },
        }),
        context.create(),
        { ...contextOptions, headers },
      );

      expect(store.headers).toMatchObject({
        required: "header-value",
      });
    });

    it("omits headers from the context when no headers have been provided", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create(),
        context.create(),
        contextOptions,
      );

      expect(store.headers).toBeUndefined();
    });
  });

  describe("Integrations", () => {
    it("includes integrations in the context when the route references a domain integration", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const integrations = { testIntegration: vi.fn() };

      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create(),
        context.create(),
        { ...contextOptions, integrations },
      );

      expect(store.integrations).toBe(integrations);
    });

    it("omits integrations from the context when the route does not reference any domain integrations", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create(),
        context.create(),
        contextOptions,
      );

      expect(store.integrations).toBeUndefined();
    });
  });

  describe("Feature Flags", () => {
    it("includes feature flags in the context when the route references domain feature flags", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const featureFlags = { flagA: true, flagB: false };

      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create(),
        context.create(),
        { ...contextOptions, featureFlags },
      );

      expect(store.featureFlags).toStrictEqual({ flagA: true, flagB: false });
    });

    it("omits feature flags from the context when the route does not reference any", ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const store = buildHandlerContext(
        privateGatewayEventWithAuthorizer.create(),
        context.create(),
        contextOptions,
      );

      expect(store.featureFlags).toBeUndefined();
    });
  });
});
