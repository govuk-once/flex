import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { flexFetch } from "../fetch";
import { createSigv4Fetcher, createSigv4FetchWithCredentials } from ".";

const createSignedFetcherMock = vi.fn((_opts: unknown) =>
  vi.fn(() => Promise.resolve(new Response("{}"))),
);

vi.mock("@aws-sdk/credential-providers", () => ({
  fromTemporaryCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "test-access-key-id",
    secretAccessKey: "test-secret-access-key", // pragma: allowlist secret
    sessionToken: "test-session-token",
  }),
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

vi.mock("aws-sigv4-fetch", () => ({
  createSignedFetcher: (opts: unknown) => createSignedFetcherMock(opts),
}));

vi.mock("../fetch", () => ({
  flexFetch: vi.fn(
    (_url: string | URL, _options: object, _fetcher: typeof fetch) => ({
      request: Promise.resolve(new Response("{}")),
      abort: vi.fn(),
    }),
  ),
}));

describe("createSigv4Fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns flex fetch wrapper with signed fetch function", () => {
    const fetcher = createSigv4Fetcher({
      baseUrl: "https://api.example.com",
      region: "us-east-1",
    });

    expect(fetcher).toBeDefined();
    expect(fetcher.request).toBeInstanceOf(Promise);
    expect(fetcher.abort).toBeInstanceOf(Function);
  });

  it("calls createSignedFetcher with baseUrl, region, and service", () => {
    createSigv4Fetcher({
      baseUrl: "https://api.example.com",
      region: "us-east-1",
    });

    expect(createSignedFetcherMock).toHaveBeenCalledTimes(1);
    expect(createSignedFetcherMock).toHaveBeenCalledWith({
      baseUrl: "https://api.example.com",
      region: "us-east-1",
      service: "execute-api",
    });
  });

  it("passes options transparently to flexFetch", () => {
    const fetchOptions = {
      retryAttempts: 3 as const,
      maxRetryDelay: 500,
      headers: { "X-Custom": "value" },
    };

    createSigv4Fetcher({
      baseUrl: "https://api.example.com",
      region: "us-east-1",
      fetchOptions,
    });

    expect(flexFetch).toHaveBeenCalledWith(
      "https://api.example.com",
      fetchOptions,
      expect.any(Function),
    );
  });

  it("passes custom credentials to createSignedFetcher", () => {
    const credentials = {
      accessKeyId: "custom-key",
      secretAccessKey: "custom-secret", // pragma: allowlist secret
    };

    createSigv4Fetcher({
      baseUrl: "https://api.example.com",
      region: "us-east-1",
      credentials,
    });

    expect(createSignedFetcherMock).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials,
        service: "execute-api",
      }),
    );
  });

  it("accepts URL object as baseUrl", () => {
    const baseUrl = new URL("https://api.example.com");
    const fetchOptions = { retryAttempts: 1 as const };

    createSigv4Fetcher({
      baseUrl,
      region: "eu-west-2",
      fetchOptions,
    });

    expect(flexFetch).toHaveBeenCalledWith(
      baseUrl,
      fetchOptions,
      expect.any(Function),
    );
  });

  it("uses default fetch options when none are provided", () => {
    createSigv4Fetcher({
      baseUrl: "https://api.example.com",
      region: "us-east-1",
    });

    expect(flexFetch).toHaveBeenCalledWith(
      "https://api.example.com",
      {},
      expect.any(Function),
    );
  });
});

describe("createSigv4FetchWithCredentials", () => {
  const baseOptions = {
    baseUrl: "https://api.example.com",
    region: "us-east-1",
    roleName: "test-role",
    roleArn: "arn:aws:iam::111111111111:role/cache-role",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caches credentials on subsequent calls", () => {
    createSigv4FetchWithCredentials(baseOptions);
    createSigv4FetchWithCredentials(baseOptions);

    expect(fromTemporaryCredentials).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "when externalId is omitted",
      options: {
        ...baseOptions,
        roleArn: "arn:...:role/no-ext",
        externalId: undefined,
      },
      expectedParams: {
        RoleArn: "arn:...:role/no-ext",
        RoleSessionName: "test-role",
      },
    },
    {
      name: "when externalId is provided",
      options: {
        ...baseOptions,
        roleArn: "arn:...:role/ext",
        externalId: "my-ext-id",
      },
      expectedParams: {
        RoleArn: "arn:...:role/ext",
        RoleSessionName: "test-role",
        ExternalId: "my-ext-id",
      },
    },
  ])("$name", ({ options, expectedParams }) => {
    createSigv4FetchWithCredentials(options);
    expect(fromTemporaryCredentials).toHaveBeenCalledWith({
      params: expectedParams,
    });
  });

  it("creates separate credential providers for different roleArn or externalId", () => {
    createSigv4FetchWithCredentials({
      ...baseOptions,
      roleArn: "arn:aws:iam::444444444444:role/role-a",
    });
    createSigv4FetchWithCredentials({
      ...baseOptions,
      roleArn: "arn:aws:iam::555555555555:role/role-b",
    });
    createSigv4FetchWithCredentials({
      ...baseOptions,
      roleArn: "arn:aws:iam::444444444444:role/role-a",
    });

    expect(fromTemporaryCredentials).toHaveBeenCalledTimes(2);
  });
});
