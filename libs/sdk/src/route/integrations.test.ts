import { it } from "@flex/testing";
import { assert, beforeEach, describe, expect, vi } from "vitest";
import z from "zod";

import type { DomainConfig, IntegrationResult } from "../types";
import { AuthorizationError } from "../utils/errors";
import type { IntegrationInvokerConfig, InvokerOptions } from "./integrations";
import {
  buildDomainIntegrations,
  createBearerFetcher,
  createIntegrationInvoker,
  parseIntegrationRoute,
  toIntegrationResult,
} from "./integrations";
import { routeStorage } from "./store";

const mockFetcher = vi.hoisted(() => vi.fn());
const mockTypedFetch = vi.hoisted(() => vi.fn());
const mockCreateSigv4Fetcher = vi.hoisted(() => vi.fn(() => mockFetcher));
const mockFlexFetch = vi.hoisted(() => vi.fn());

vi.mock("@flex/flex-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flex/flex-fetch")>()),
  createSigv4Fetcher: mockCreateSigv4Fetcher,
  flexFetch: mockFlexFetch,
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

  describe("public integrations", () => {
    const publicGateway = {
      key: "publicApiUrl",
      url: "https://api.example.com",
      path: "/flex/apigw/public/url",
    };

    const publicOnlyConfig: DomainConfig = {
      name: "test-domain",
      resources: {
        [publicGateway.key]: { type: "ssm", path: publicGateway.path },
      },
      integrations: {
        publicCall: {
          type: "public",
          target: "target-domain",
          route: "GET /v1/public-endpoint",
        },
      },
      routes: {},
    };

    it("does not create a SigV4 fetcher when only public integrations exist", ({
      env,
    }) => {
      env.set({ AWS_REGION: region, [publicGateway.key]: publicGateway.url });

      buildDomainIntegrations(publicOnlyConfig);

      expect(mockCreateSigv4Fetcher).not.toHaveBeenCalled();
    });

    it("resolves the public API URL when a public integration exists", ({
      env,
    }) => {
      env.set({ AWS_REGION: region, [publicGateway.key]: publicGateway.url });

      const result = buildDomainIntegrations(publicOnlyConfig);

      assert(result !== undefined, "No integrations built");
      expect(result.publicCall).toBeTypeOf("function");
    });

    it("throws when the public API URL is missing from resources", ({
      env,
    }) => {
      env.set({ AWS_REGION: region });

      expect(() =>
        buildDomainIntegrations({
          ...publicOnlyConfig,
          resources: { unrelated: { type: "ssm", path: "/some/other/param" } },
        }),
      ).toThrow(`"${publicGateway.path}" resource was not found`);
    });

    it("builds both fetchers when public and private integrations coexist", ({
      env,
    }) => {
      env.set({
        AWS_REGION: region,
        [gateway.key]: gateway.url,
        [publicGateway.key]: publicGateway.url,
      });

      const result = buildDomainIntegrations({
        ...domainConfig,
        resources: {
          [gateway.key]: { type: "ssm", path: gateway.path },
          [publicGateway.key]: { type: "ssm", path: publicGateway.path },
        },
        integrations: {
          ...domainConfig.integrations,
          publicCall: {
            type: "public",
            target: "target-domain",
            route: "GET /v1/public-endpoint",
          },
        },
      });

      expect(mockCreateSigv4Fetcher).toHaveBeenCalledOnce();
      assert(result !== undefined, "No integrations built");
      expect(result.publicCall).toBeTypeOf("function");
      expect(result.sameDomain).toBeTypeOf("function");
    });
  });
});

describe("createBearerFetcher", () => {
  type FlexFetchCall = [string, { headers: Record<string, string> }];

  function lastFlexFetchCall(): FlexFetchCall {
    return mockFlexFetch.mock.lastCall as FlexFetchCall;
  }

  beforeEach(() => {
    mockFlexFetch.mockReturnValue({
      request: Promise.resolve(new Response()),
      abort: vi.fn(),
    });
  });

  it("forwards the inbound bearer token on the outbound request", () => {
    const fetcher = createBearerFetcher({
      baseUrl: "https://api.example.com",
      getToken: () => "Bearer eyJabc",
    });

    fetcher("/app/dvla/v1/driving-licence", { method: "GET" });

    const [url, options] = lastFlexFetchCall();
    expect(url).toBe("https://api.example.com/app/dvla/v1/driving-licence");
    expect(options.headers.Authorization).toBe("Bearer eyJabc");
  });

  it("prefixes the token with 'Bearer ' when not already present", () => {
    const fetcher = createBearerFetcher({
      baseUrl: "https://api.example.com",
      getToken: () => "rawTokenWithoutPrefix",
    });

    fetcher("/app/dvla/v1/driving-licence", { method: "GET" });

    const [, options] = lastFlexFetchCall();
    expect(options.headers.Authorization).toBe("Bearer rawTokenWithoutPrefix");
  });

  it("throws AuthorizationError when no inbound bearer token is available", () => {
    const fetcher = createBearerFetcher({
      baseUrl: "https://api.example.com",
      getToken: () => undefined,
    });

    expect(() =>
      fetcher("/app/dvla/v1/driving-licence", { method: "GET" }),
    ).toThrow(AuthorizationError);
  });

  it("reads the token lazily via getToken (per call, not per build)", () => {
    const tokenRef: { current: string | undefined } = { current: undefined };
    const fetcher = createBearerFetcher({
      baseUrl: "https://api.example.com",
      getToken: () => tokenRef.current,
    });

    expect(() => fetcher("/foo", { method: "GET" })).toThrow(
      AuthorizationError,
    );

    tokenRef.current = "Bearer xyz";
    fetcher("/foo", { method: "GET" });

    const [url, options] = lastFlexFetchCall();
    expect(url).toBe("https://api.example.com/foo");
    expect(options.headers.Authorization).toBe("Bearer xyz");
  });

  it("integrates with routeStorage so route handlers' auth is forwarded", () => {
    const fetcher = createBearerFetcher({
      baseUrl: "https://api.example.com",
      getToken: () => routeStorage.getStore()?.auth?.bearerToken,
    });

    routeStorage.run(
      {
        // Minimal store satisfying the shape we exercise.
        logger: { info: vi.fn() } as never,
        auth: { pairwiseId: "user-1", bearerToken: "Bearer storedToken" },
      },
      () => fetcher("/foo", { method: "GET" }),
    );

    const [, options] = lastFlexFetchCall();
    expect(options.headers.Authorization).toBe("Bearer storedToken");
  });
});

describe("createIntegrationInvoker", () => {
  const createInvoker = (config: IntegrationInvokerConfig) =>
    createIntegrationInvoker(mockFetcher, config) as (
      options?: InvokerOptions,
    ) => Promise<IntegrationResult>;

  const invokerConfig = {
    path: {
      method: "GET",
      basePath: "/domains/test-domain/v1",
      path: "/endpoint",
      isWildcard: false,
    },
    wildcard: {
      method: "GET",
      basePath: "/gateways/test-domain/v1",
      path: "",
      isWildcard: true,
    },
    wildcardWithPrefix: {
      method: "GET",
      basePath: "/gateways/test-domain/v1",
      path: "/prefix",
      isWildcard: true,
    },
  } satisfies Record<string, IntegrationInvokerConfig>;

  beforeEach(() => {
    mockFetcher.mockReturnValue({
      request: Promise.resolve(new Response()),
      abort: vi.fn(),
    });
    mockTypedFetch.mockResolvedValue({ ok: true, status: 200, data: null });
  });

  describe("Request URL", () => {
    it("uses the configured path for a fixed path integration", async () => {
      const caller = createInvoker(invokerConfig.path);

      await caller();

      expect(mockFetcher).toHaveBeenCalledExactlyOnceWith(
        "/domains/test-domain/v1/endpoint",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("uses the base path when no caller path is provided for a root wildcard integration", async () => {
      const caller = createInvoker(invokerConfig.wildcard);

      await caller();

      expect(mockFetcher).toHaveBeenCalledExactlyOnceWith(
        "/gateways/test-domain/v1",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("appends the caller path for a root wildcard integration", async () => {
      const caller = createInvoker(invokerConfig.wildcard);

      await caller({ path: "/custom" });

      expect(mockFetcher).toHaveBeenCalledExactlyOnceWith(
        "/gateways/test-domain/v1/custom",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("uses the base path with prefix when no caller path is provided for a prefixed wildcard integration", async () => {
      const caller = createInvoker(invokerConfig.wildcardWithPrefix);

      await caller();

      expect(mockFetcher).toHaveBeenCalledExactlyOnceWith(
        "/gateways/test-domain/v1/prefix",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("appends the caller path for a prefixed wildcard integration", async () => {
      const caller = createInvoker(invokerConfig.wildcardWithPrefix);

      await caller({ path: "/custom" });

      expect(mockFetcher).toHaveBeenCalledExactlyOnceWith(
        "/gateways/test-domain/v1/prefix/custom",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("appends caller query parameters to the URL", async () => {
      const caller = createInvoker(invokerConfig.path);

      await caller({ query: { key: "value" } });

      expect(mockFetcher).toHaveBeenCalledOnce();

      const [url] = mockFetcher.mock.lastCall as [string];
      const [, query] = url.split("?");

      expect(new URLSearchParams(query).get("key")).toBe("value");
    });
  });

  describe("Request Options", () => {
    it("serialises the request body and sets content type when a body is provided", async () => {
      const caller = createInvoker(invokerConfig.path);

      await caller({ body: { key: "value" } });

      const [, { body, headers }] = mockFetcher.mock.lastCall as [
        string,
        InvokerOptions,
      ];

      expect(body).toStrictEqual(JSON.stringify({ key: "value" }));
      expect(headers).toStrictEqual({ "Content-Type": "application/json" });
    });

    it("omits body and content type when no body is provided", async () => {
      const caller = createInvoker(invokerConfig.path);

      await caller();

      const [, { body, headers }] = mockFetcher.mock.lastCall as [
        string,
        InvokerOptions,
      ];

      expect(body).toBeUndefined();
      expect(headers).toBeUndefined();
    });

    it("merges caller provided headers with base headers when a body and headers are both provided", async () => {
      const caller = createInvoker(invokerConfig.path);

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
        ...invokerConfig.path,
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
        ...invokerConfig.path,
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

      const caller = createInvoker({ ...invokerConfig.path, schema });

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

      const caller = createInvoker(invokerConfig.path);

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
      label: "a root wildcard route",
      routeKey: "GET /v1/*",
      expected: {
        method: "GET",
        version: "v1",
        path: "",
        gateway: "public",
        isWildcard: true,
      },
    },
    {
      label: "a wildcard with prefix route",
      routeKey: "POST /v1/identity/*",
      expected: {
        method: "POST",
        version: "v1",
        path: "/identity",
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
