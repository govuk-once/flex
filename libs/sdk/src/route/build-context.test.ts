import { logger } from "@flex/logging";
import { it, userId } from "@flex/testing";
import { RequestBodyParseError } from "@flex/utils";
import { describe, expect, vi } from "vitest";
import z from "zod";

import type { BuildContextOptions } from "./build-context";
import { buildHandlerContext } from "./build-context";

vi.mock("@flex/logging");

describe("buildHandlerContext", () => {
  const endpoint = "/example";
  const contextOptions: BuildContextOptions = {
    gateway: "private",
    logger,
  };

  describe("Logger", () => {
    it("includes a logger in the context", ({ sdk }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint),
        sdk.context(),
        { ...contextOptions, gateway: "public" },
      );

      expect(store.logger).toBe(logger);
    });
  });

  describe("Auth", () => {
    it("includes auth in the context when gateway is public", ({ sdk }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint, { auth: userId }),
        sdk.context(),
        { ...contextOptions, gateway: "public" },
      );

      expect(store.auth).toStrictEqual({ pairwiseId: userId });
    });

    it("omits auth from the context when gateway is private", ({ sdk }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint, { auth: userId }),
        sdk.context(),
        { ...contextOptions, gateway: "private" },
      );

      expect(store.auth).toBeUndefined();
    });

    it("throws when pairwise ID is missing from the authorizer context", ({
      sdk,
    }) => {
      expect(() =>
        buildHandlerContext(
          sdk.event.get(endpoint, { auth: false }),
          sdk.context(),
          { ...contextOptions, gateway: "public" },
        ),
      ).toThrow("Failed to extract the pairwise ID from the request context");
    });
  });

  describe("Request Body", () => {
    const body = { key: "value" };
    const schema = z.object({ key: z.literal("value") });

    it("parses and includes the request body in the context when a body schema is provided", ({
      sdk,
    }) => {
      const store = buildHandlerContext(
        sdk.event.post(endpoint, { body }),
        sdk.context(),
        { ...contextOptions, bodySchema: schema },
      );

      expect(store.body).toStrictEqual({ key: "value" });
    });

    it("omits body from the context when no schema is provided", ({ sdk }) => {
      const store = buildHandlerContext(
        sdk.event.post(endpoint, { body }),
        sdk.context(),
        contextOptions,
      );

      expect(store.body).toBeUndefined();
    });

    it("throws when the request body fails to parse", ({ sdk }) => {
      expect(() =>
        buildHandlerContext(
          sdk.event.post(endpoint, { body: { key: "invalid" } }),
          sdk.context(),
          { ...contextOptions, bodySchema: schema },
        ),
      ).toThrow(RequestBodyParseError);
    });
  });

  describe("Path Parameters", () => {
    it("includes path params in the context when the event contains at least one path parameter", ({
      sdk,
    }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint, { params: { key: "value" } }),
        sdk.context(),
        contextOptions,
      );

      expect(store.pathParams).toStrictEqual({ key: "value" });
    });

    it("omits path params from the context when the event has no path parameters", ({
      sdk,
    }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint, { params: {} }),
        sdk.context(),
        contextOptions,
      );

      expect(store.pathParams).toBeUndefined();
    });
  });

  describe("Query Parameters", () => {
    it("parses and includes query params in the context when a query schema is provided", ({
      sdk,
    }) => {
      const schema = z.object({ key: z.literal("value") });

      const store = buildHandlerContext(
        sdk.event.get(endpoint, { query: { key: "value" } }),
        sdk.context(),
        { ...contextOptions, querySchema: schema },
      );

      expect(store.queryParams).toStrictEqual({ key: "value" });
    });

    it("omits query params from the context when a query schema is not provided", ({
      sdk,
    }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint, { query: { key: "value" } }),
        sdk.context(),
        contextOptions,
      );

      expect(store.queryParams).toBeUndefined();
    });
  });

  describe("Resources", () => {
    it("resolves resources from the environment variables", ({ sdk }) => {
      const resources = {
        testKey: { type: "kms" as const, value: "test-key-value" },
        testParam: { type: "ssm" as const, value: "test-param-value" },
      };

      const store = buildHandlerContext(
        sdk.event.get(endpoint),
        sdk.context(),
        { ...contextOptions, resources },
      );

      expect(store.resources).toStrictEqual({
        testKey: "test-key-value",
        testParam: "test-param-value",
      });
    });

    it("resolves resources from the Lambda context", ({ sdk }) => {
      const resources = {
        testKey: { type: "kms" as const, value: "test-key-value" },
        testParam: { type: "ssm" as const, value: "test-param-value" },
        testSecret: { type: "secret" as const, value: "test-secret-name" },
      };

      const store = buildHandlerContext(
        sdk.event.get(endpoint),
        sdk.context({ secrets: { testSecret: "test-secret-value" } }), // pragma: allowlist secret
        { ...contextOptions, resources },
      );

      expect(store.resources).toStrictEqual({
        testKey: "test-key-value",
        testParam: "test-param-value",
        testSecret: "test-secret-value", // pragma: allowlist secret
      });
    });

    it("throws when a resource has not been resolved by middleware", ({
      sdk,
    }) => {
      const resources = {
        testSecret: { type: "secret" as const, value: "test-secret-name" },
      };

      expect(() =>
        buildHandlerContext(sdk.event.get(endpoint), sdk.context(), {
          ...contextOptions,
          resources,
        }),
      ).toThrow(
        '"testSecret" (secret) resource was not resolved by middleware',
      );
    });

    it("omits resources from the context when the route does not reference any domain resources", ({
      sdk,
    }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint),
        sdk.context(),
        contextOptions,
      );

      expect(store.resources).toBeUndefined();
    });
  });

  describe("Headers", () => {
    it("resolves and includes headers in the context when at least one header is provided", ({
      sdk,
    }) => {
      const headers = {
        required: { name: "x-required", required: true },
        optional: { name: "x-optional", required: false },
      };

      const store = buildHandlerContext(
        sdk.event.get(endpoint, { headers: { "x-required": "header-value" } }),
        sdk.context(),
        { ...contextOptions, headers },
      );

      expect(store.headers).toMatchObject({
        required: "header-value",
      });
    });

    it("omits headers from the context when no headers have been provided", ({
      sdk,
    }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint),
        sdk.context(),
        contextOptions,
      );

      expect(store.headers).toBeUndefined();
    });
  });

  describe("Integrations", () => {
    it("includes integrations in the context when the route references a domain integration", ({
      sdk,
    }) => {
      const integrations = { testIntegration: vi.fn() };

      const store = buildHandlerContext(
        sdk.event.get(endpoint),
        sdk.context(),
        { ...contextOptions, integrations },
      );

      expect(store.integrations).toBe(integrations);
    });

    it("omits integrations from the context when the route does not reference any domain integrations", ({
      sdk,
    }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint),
        sdk.context(),
        contextOptions,
      );

      expect(store.integrations).toBeUndefined();
    });
  });

  describe("Feature Flags", () => {
    it("includes feature flags in the context when the route references domain feature flags", ({
      sdk,
    }) => {
      const featureFlags = { flagA: true, flagB: false };

      const store = buildHandlerContext(
        sdk.event.get(endpoint),
        sdk.context(),
        { ...contextOptions, featureFlags },
      );

      expect(store.featureFlags).toStrictEqual({ flagA: true, flagB: false });
    });

    it("omits feature flags from the context when the route does not reference any", ({
      sdk,
    }) => {
      const store = buildHandlerContext(
        sdk.event.get(endpoint),
        sdk.context(),
        contextOptions,
      );

      expect(store.featureFlags).toBeUndefined();
    });
  });
});
