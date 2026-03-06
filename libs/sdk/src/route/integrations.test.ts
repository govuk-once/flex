import { it } from "@flex/testing";
import { assert, beforeEach, describe, expect, vi } from "vitest";
import z from "zod";

import type { DomainConfig, IntegrationResult } from "../types";
import type { IntegrationInvokerConfig, InvokerOptions } from "./integrations";
import {
  buildDomainIntegrations,
  createIntegrationInvoker,
  parseIntegrationRoute,
  toIntegrationResult,
} from "./integrations";

const mockFetcher = vi.hoisted(() => vi.fn());
const mockTypedFetch = vi.hoisted(() => vi.fn());
const mockCreateSigv4Fetcher = vi.hoisted(() => vi.fn(() => mockFetcher));

vi.mock("@flex/flex-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flex/flex-fetch")>()),
  createSigv4Fetcher: mockCreateSigv4Fetcher,
  typedFetch: mockTypedFetch,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildDomainIntegrations", () => {
  const gateway = {
    key: "gatewayKey",
    url: "https://gateway.example.com",
    path: "/flex/apigw/private/gateway-url",
  };
  const region = "eu-west-2";

  const domainConfig: DomainConfig = {
    name: "test-domain",
    resources: {
      [gateway.key]: { type: "ssm", path: gateway.path },
    },
    integrations: {
      sameDomain: { type: "domain", route: "GET /v1/endpoint" },
      crossDomain: {
        type: "domain",
        target: "target-domain",
        route: "GET /v1/target/endpoint",
      },
    },
    routes: {},
  };

  it("returns undefined when no domain integrations have been defined", () => {
    expect(
      buildDomainIntegrations({ ...domainConfig, integrations: undefined }),
    ).toBeUndefined();
    expect(
      buildDomainIntegrations({ ...domainConfig, integrations: {} }),
    ).toBeUndefined();
  });

  it("throws when AWS region is not set", ({ env }) => {
    env.set({ AWS_REGION: undefined });

    expect(() => buildDomainIntegrations(domainConfig)).toThrow(
      "AWS region is required when an integration is defined",
    );
  });

  it("throws when no domain resources have been defined", ({ env }) => {
    env.set({ AWS_REGION: region });

    expect(() =>
      buildDomainIntegrations({ ...domainConfig, resources: undefined }),
    ).toThrow(
      "Domain resources must define a gateway URL when integrations are used",
    );
    expect(() =>
      buildDomainIntegrations({ ...domainConfig, resources: {} }),
    ).toThrow(
      "Domain resources must define a gateway URL when integrations are used",
    );
  });

  it("throws when the gateway URL is missing from domain resources", ({
    env,
  }) => {
    env.set({ AWS_REGION: region });

    expect(() =>
      buildDomainIntegrations({
        ...domainConfig,
        resources: { example: { type: "ssm", path: "/some/other/param" } },
      }),
    ).toThrow(`"${gateway.path}" resource was not found`);
  });

  it("throws when the gateway URL environment variable is not set", ({
    env,
  }) => {
    env.set({ AWS_REGION: region });

    expect(() => buildDomainIntegrations(domainConfig)).toThrow(
      `Environment variable "${gateway.key}" for gateway URL does not exist`,
    );
  });

  it("creates a SigV4 fetcher with the correct gateway URL and region", ({
    env,
  }) => {
    env.set({ AWS_REGION: region, [gateway.key]: gateway.url });

    buildDomainIntegrations(domainConfig);

    expect(mockCreateSigv4Fetcher).toHaveBeenCalledExactlyOnceWith({
      baseUrl: "https://gateway.example.com",
      region: "eu-west-2",
    });
  });

  it("returns a callable function for each domain integration", ({ env }) => {
    env.set({ AWS_REGION: region, [gateway.key]: gateway.url });

    const result = buildDomainIntegrations(domainConfig);

    assert(result !== undefined, "No domain integrations exist");

    expect(result.sameDomain).toBeTypeOf("function");
    expect(result.crossDomain).toBeTypeOf("function");
  });
});

describe("createIntegrationInvoker", () => {
  const createInvoker = (config: IntegrationInvokerConfig) =>
    createIntegrationInvoker(mockFetcher, config) as (
      options?: InvokerOptions,
    ) => Promise<IntegrationResult>;

  const invokerConfig: IntegrationInvokerConfig = {
    method: "POST",
    basePath: "/domains/test-domain/v1",
    path: "/endpoint",
    isWildcard: false,
  };

  beforeEach(() => {
    mockFetcher.mockReturnValue({
      request: Promise.resolve(new Response()),
      abort: vi.fn(),
    });
    mockTypedFetch.mockResolvedValue({ ok: true, status: 200, data: null });
  });

  describe("Request URL", () => {
    const invokerPathConfig: IntegrationInvokerConfig = {
      method: "GET",
      basePath: "/domains/test-domain/v1",
      path: "/endpoint",
      isWildcard: false,
    };

    const invokerWildcardConfig: IntegrationInvokerConfig = {
      method: "GET",
      basePath: "/gateways/test-domain/v1",
      path: "/",
      isWildcard: true,
    };

    it("uses the configured path for a fixed path integration", async () => {
      const caller = createInvoker(invokerPathConfig);

      await caller();

      expect(mockFetcher).toHaveBeenCalledExactlyOnceWith(
        "/domains/test-domain/v1/endpoint",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("uses the path provided by the caller for a wildcard integration", async () => {
      const caller = createInvoker(invokerWildcardConfig);

      await caller({ path: "/custom" });

      expect(mockFetcher).toHaveBeenCalledExactlyOnceWith(
        "/gateways/test-domain/v1/custom",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("uses the base path when no path is provided for a wildcard integration", async () => {
      const caller = createInvoker(invokerWildcardConfig);

      await caller();

      expect(mockFetcher).toHaveBeenCalledExactlyOnceWith(
        "/gateways/test-domain/v1",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("appends caller query parameters to the URL", async () => {
      const caller = createInvoker(invokerPathConfig);

      await caller({ query: { key: "value" } });

      expect(mockFetcher).toHaveBeenCalledOnce();

      const [url] = mockFetcher.mock.lastCall as [string];
      const [, query] = url.split("?");

      expect(new URLSearchParams(query).get("key")).toBe("value");
    });
  });

  describe("Request Options", () => {
    it("serialises the request body and sets content type when a body is provided", async () => {
      const caller = createInvoker(invokerConfig);

      await caller({ body: { key: "value" } });

      const [, { body, headers }] = mockFetcher.mock.lastCall as [
        string,
        InvokerOptions,
      ];

      expect(body).toStrictEqual(JSON.stringify({ key: "value" }));
      expect(headers).toStrictEqual({ "Content-Type": "application/json" });
    });

    it("omits body and content type when no body is provided", async () => {
      const caller = createInvoker(invokerConfig);

      await caller();

      const [, { body, headers }] = mockFetcher.mock.lastCall as [
        string,
        InvokerOptions,
      ];

      expect(body).toBeUndefined();
      expect(headers).toBeUndefined();
    });

    it("merges caller provided headers with base headers when a body and headers are both provided", async () => {
      const caller = createInvoker(invokerConfig);

      await caller({
        body: { key: "value" },
        headers: { "x-custom": "header" },
      });

      const [, { headers }] = mockFetcher.mock.lastCall as [
        string,
        InvokerOptions,
      ];

      expect(headers).toStrictEqual({
        "Content-Type": "application/json",
        "x-custom": "header",
      });
    });

    it("uses integration retry config when provided", async () => {
      const caller = createInvoker({
        ...invokerConfig,
        maxRetryDelay: 1,
        retryAttempts: 1,
      });

      await caller();

      const [, { maxRetryDelay, retryAttempts }] = mockFetcher.mock
        .lastCall as [string, InvokerOptions];

      expect(maxRetryDelay).toBe(1);
      expect(retryAttempts).toBe(1);
    });

    it("uses caller retry config over integration retry config when both are provided", async () => {
      const caller = createInvoker({
        ...invokerConfig,
        maxRetryDelay: 1,
        retryAttempts: 1,
      });

      await caller({ maxRetryDelay: 2, retryAttempts: 2 });

      const [, { maxRetryDelay, retryAttempts }] = mockFetcher.mock
        .lastCall as [string, InvokerOptions];

      expect(maxRetryDelay).toBe(2);
      expect(retryAttempts).toBe(2);
    });
  });

  describe("Response", () => {
    it("validates the response against the schema when provided", async () => {
      const schema = z.object({ key: z.literal("value") });

      const caller = createInvoker({ ...invokerConfig, schema });

      await caller();

      expect(mockTypedFetch).toHaveBeenCalledExactlyOnceWith(
        expect.any(Promise),
        schema,
      );
    });

    it("returns a failed result when the request is unsuccessful", async () => {
      mockTypedFetch.mockResolvedValue({
        ok: false,
        error: { status: 404, message: "Not found" },
      });

      const caller = createInvoker(invokerConfig);

      expect(await caller()).toMatchObject({
        ok: false,
        error: { status: 404, message: "Not found" },
      });
    });
  });
});

describe("parseIntegrationRoute", () => {
  it.for([
    {
      label: "a public route",
      routeKey: "GET /v1/endpoint",
      expected: {
        method: "GET",
        version: "v1",
        path: "/endpoint",
        gateway: "public",
        isWildcard: false,
      },
    },
    {
      label: "a private route",
      routeKey: "POST /v1/endpoint [private]",
      expected: {
        method: "POST",
        version: "v1",
        path: "/endpoint",
        gateway: "private",
        isWildcard: false,
      },
    },
    {
      label: "a wildcard route",
      routeKey: "GET /v1/*",
      expected: {
        method: "GET",
        version: "v1",
        path: "/",
        gateway: "public",
        isWildcard: true,
      },
    },
  ])("parses $label", ({ routeKey, expected }) => {
    expect(parseIntegrationRoute(routeKey)).toStrictEqual(expected);
  });
});

describe("toIntegrationResult", () => {
  it("maps a successful result to an integration result", () => {
    expect(
      toIntegrationResult({ ok: true, status: 200, data: { key: "value" } }),
    ).toStrictEqual({ ok: true, status: 200, data: { key: "value" } });
  });

  it("maps a failed result to an integration result", () => {
    expect(
      toIntegrationResult({
        ok: false,
        error: {
          status: 502,
          message: "Bad Gateway",
          body: { detail: "upstream error" },
        },
      }),
    ).toStrictEqual({
      ok: false,
      error: {
        status: 502,
        message: "Bad Gateway",
        body: { detail: "upstream error" },
      },
    });
  });
});
