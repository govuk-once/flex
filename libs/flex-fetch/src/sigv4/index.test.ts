import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import {
  createSigv4Fetch,
  createSigv4FetchWithCredentials,
  sigv4Fetch,
} from "./index";

const mockSignedFetcher = vi.fn();
const mockFlexFetch = vi.fn();
const mockFromTemporaryCredentials = vi.fn();

vi.mock("aws-sigv4-fetch", () => ({
  createSignedFetcher: vi.fn(() => mockSignedFetcher),
}));
vi.mock("@flex/logging", () => {
  const loggerFunctions = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  return {
    getLogger: () => loggerFunctions,
  };
});

vi.mock("../fetch/index.js", () => ({
  flexFetch: vi.fn((url: unknown, options?: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- vi mock passthrough
    mockFlexFetch(url, options),
  ),
}));

vi.mock("@aws-sdk/credential-providers", () => ({
  fromTemporaryCredentials: (opts: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- vi mock passthrough
    mockFromTemporaryCredentials(opts),
}));

describe("sigv4Fetch", () => {
  /**
   * Generates the expected options object passed to flexFetch as the 2nd arg.
   * flexFetch(url, options) - use with expect.objectContaining() to avoid mock.calls.
   */
  const fullFlexFetchOptions = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    fetcher: mockSignedFetcher,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Host: "api.example.com",
    },
    maxRetryDelay: undefined,
    method: "GET",
    retryAttempts: 3,
    body: undefined,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFlexFetch.mockReturnValue({
      request: Promise.resolve(new Response("{}", { status: 200 })),
    });
  });

  it("calls createSignedFetcher with service, region, and credentials", async () => {
    const { createSignedFetcher } = await import("aws-sigv4-fetch");
    const creds = { accessKeyId: "x", secretAccessKey: "y" };

    await sigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "GET",
      path: "/v1/data",
      credentials: creds,
    });

    expect(createSignedFetcher).toHaveBeenCalledWith({
      service: "execute-api",
      region: "eu-west-2",
      credentials: creds,
    });
  });

  it("calls flexFetch with signed fetcher, URL, method, headers, and default retries", async () => {
    await sigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "GET",
      path: "/v1/data",
    });

    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining(fullFlexFetchOptions()),
    );
  });

  it("passes body as JSON string for POST", async () => {
    const body = { foo: "bar" };
    await sigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "POST",
      path: "/v1/data",
      body,
    });

    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining(
        fullFlexFetchOptions({ body: JSON.stringify(body), method: "POST" }),
      ),
    );
  });

  it("merges custom headers with default headers", async () => {
    await sigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "GET",
      path: "/v1/data",
      headers: { "X-Custom": "value" },
    });

    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining(
        fullFlexFetchOptions({
          headers: {
            "X-Custom": "value",
            "Content-Type": "application/json",
            Accept: "application/json",
            Host: "api.example.com",
          },
        }),
      ),
    );
  });

  it("uses custom host when provided", async () => {
    await sigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "GET",
      path: "/v1/data",
      host: "custom-host.example.com",
    });

    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining(
        fullFlexFetchOptions({
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Host: "custom-host.example.com",
          },
        }),
      ),
    );
  });

  it("passes retryAttempts: 0 as undefined to flexFetch", async () => {
    await sigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "GET",
      path: "/v1/data",
      retryAttempts: 0,
    });

    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining(
        fullFlexFetchOptions({ retryAttempts: undefined }),
      ),
    );
  });

  it("passes custom retryAttempts and maxRetryDelay to flexFetch", async () => {
    await sigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "GET",
      path: "/v1/data",
      retryAttempts: 2,
      maxRetryDelay: 200,
    });

    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining(
        fullFlexFetchOptions({ retryAttempts: 2, maxRetryDelay: 200 }),
      ),
    );
  });

  it("returns the response from flexFetch", async () => {
    const expectedResponse = new Response('{"ok":true}', {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
    mockFlexFetch.mockReturnValue({
      request: Promise.resolve(expectedResponse),
    });

    const result = await sigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "POST",
      path: "/v1/data",
      body: {},
    });

    expect(result).toBe(expectedResponse);
    expect(result.status).toBe(201);
  });
});

describe("createSigv4Fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlexFetch.mockReturnValue({
      request: Promise.resolve(new Response("{}", { status: 200 })),
    });
  });

  it("merges base config with request options", async () => {
    const gatewayFetch = createSigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com/gateway",
      headers: { "requesting-service": "udp" },
    });

    await gatewayFetch({
      method: "GET",
      path: "/v1/notifications",
    });

    expect(mockFlexFetch).toHaveBeenCalledTimes(1);
    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: "GET",
        headers: {
          "requesting-service": "udp",
          "Content-Type": "application/json",
          Accept: "application/json",
          Host: "api.example.com",
        },
      }),
    );
  });

  it("request headers override base headers for same key", async () => {
    const gatewayFetch = createSigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      headers: { "X-Base": "base-value", "X-Shared": "base" },
    });

    await gatewayFetch({
      method: "POST",
      path: "/v1/user",
      body: { id: "123" },
      headers: { "X-Request": "request-value", "X-Shared": "request-override" },
    });

    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: {
          "X-Base": "base-value",
          "X-Request": "request-value",
          "X-Shared": "request-override",
          "Content-Type": "application/json",
          Accept: "application/json",
          Host: "api.example.com",
        },
      }),
    );
  });

  it("passes retry options from base config and request", async () => {
    const gatewayFetch = createSigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      retryAttempts: 5,
      maxRetryDelay: 300,
    });

    await gatewayFetch({ method: "GET", path: "/v1/data" });

    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        retryAttempts: 5,
        maxRetryDelay: 300,
      }),
    );
  });

  it("request retry options override base config", async () => {
    const gatewayFetch = createSigv4Fetch({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      retryAttempts: 5,
      maxRetryDelay: 300,
    });

    await gatewayFetch({
      method: "GET",
      path: "/v1/data",
      retryAttempts: 1,
      maxRetryDelay: 100,
    });

    expect(mockFlexFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        retryAttempts: 1,
        maxRetryDelay: 100,
      }),
    );
  });
});

describe("createSigv4FetchWithCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromTemporaryCredentials.mockReturnValue(
      vi.fn().mockResolvedValue({
        accessKeyId: "x",
        secretAccessKey: "y",
        sessionToken: "z",
      }),
    );
    mockFlexFetch.mockReturnValue({
      request: Promise.resolve(new Response("{}", { status: 200 })),
    });
  });

  it("calls fromTemporaryCredentials and delegates to sigv4Fetch", async () => {
    const fetchFn = createSigv4FetchWithCredentials({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "GET",
      path: "/v1/data",
      roleArn: "arn:aws:iam::123:role/Consumer",
    });
    await fetchFn({ method: "GET", path: "/v1/data" });

    expect(mockFromTemporaryCredentials).toHaveBeenCalledWith({
      params: {
        RoleArn: "arn:aws:iam::123:role/Consumer",
        RoleSessionName: "consumer-session",
      },
    });
    expect(mockFlexFetch).toHaveBeenCalledTimes(1);
  });

  it("passes externalId when provided", async () => {
    const fetchFn = createSigv4FetchWithCredentials({
      region: "eu-west-2",
      baseUrl: "https://api.example.com",
      method: "GET",
      path: "/v1/data",
      roleArn: "arn:aws:iam::123:role/Consumer",
      externalId: "ext-123",
    });
    await fetchFn({ method: "GET", path: "/v1/data" });

    expect(mockFromTemporaryCredentials).toHaveBeenCalledWith({
      params: {
        RoleArn: "arn:aws:iam::123:role/Consumer",
        RoleSessionName: "consumer-session",
        ExternalId: "ext-123",
      },
    });
  });
});
