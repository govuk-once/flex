import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { logger } from "@flex/logging";
import { memoize } from "@smithy/property-provider";
import type { AwsCredentialIdentity } from "@smithy/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { flexFetch } from "../fetch";
import { createSigv4Fetcher, createSigv4FetchWithCredentials } from ".";

const createSignedFetcherMock = vi.fn((_opts: unknown) =>
  vi.fn(() => Promise.resolve(new Response("{}"))),
);

const mockCredentialProvider = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    accessKeyId: "test-access-key-id",
    secretAccessKey: "test-secret-access-key", // pragma: allowlist secret
    sessionToken: "test-session-token",
  }),
);

vi.mock("@aws-sdk/credential-providers", () => ({
  fromTemporaryCredentials: vi.fn().mockReturnValue(mockCredentialProvider),
}));

vi.mock("@smithy/property-provider", () => ({
  memoize: vi.fn((provider: unknown) => provider),
}));

vi.mock("@flex/logging");

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
  const baseUrl = "https://api.example.com";
  const path = "/foo";
  const fullUrl = `${baseUrl}${path}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a flex fetch wrapper with a signed fetch function", () => {
    const fetcher = createSigv4Fetcher({
      baseUrl,
      region: "us-east-1",
    });

    const { request, abort } = fetcher(path);

    expect(request).toBeInstanceOf(Promise);
    expect(abort).toBeInstanceOf(Function);
  });

  it("signs request using the execute-api service for the given region", () => {
    createSigv4Fetcher({
      baseUrl,
      region: "us-east-1",
    });

    expect(createSignedFetcherMock).toHaveBeenCalledTimes(1);
    expect(createSignedFetcherMock).toHaveBeenCalledWith({
      region: "us-east-1",
      service: "execute-api",
    });
  });

  it("constructs the full URL by joining the base URL and the path", () => {
    const fetcher = createSigv4Fetcher({
      baseUrl,
      region: "us-east-1",
    });

    fetcher(path);

    expect(flexFetch).toHaveBeenCalledWith(fullUrl, {}, expect.any(Function));

    fetcher("/bar");
    expect(flexFetch).toHaveBeenCalledWith(
      `${baseUrl}/bar`,
      {},
      expect.any(Function),
    );
  });

  it("passes fetch options through to to flexFetch without modification", () => {
    const fetchOptions = {
      retryAttempts: 3 as const,
      maxRetryDelay: 500,
      headers: { "X-Custom": "value" },
    };

    const fetcher = createSigv4Fetcher({
      baseUrl,
      region: "us-east-1",
    });

    fetcher(path, fetchOptions);

    expect(flexFetch).toHaveBeenCalledWith(
      fullUrl,
      fetchOptions,
      expect.any(Function),
    );
  });

  it("forwards custom static credentials to the signed fetcher", () => {
    const credentials = {
      accessKeyId: "custom-key",
      secretAccessKey: "custom-secret", // pragma: allowlist secret
    };

    createSigv4Fetcher({
      baseUrl,
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

  it("defaults to an empty options object when no fetch options are provided", () => {
    const fetcher = createSigv4Fetcher({
      baseUrl,
      region: "us-east-1",
    });
    fetcher(path);

    expect(flexFetch).toHaveBeenCalledWith(fullUrl, {}, expect.any(Function));
  });
});

describe("createSigv4FetchWithCredentials", () => {
  const baseOptions = {
    baseUrl: "https://api.example.com",
    region: "us-east-1",
    roleName: "test-role",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wraps the credential provider with memoize to enable SDK-level credential TTL caching", () => {
    createSigv4FetchWithCredentials({
      ...baseOptions,
      roleArn: "arn:aws:iam::111111111111:role/cache-role",
    });

    expect(fromTemporaryCredentials).toHaveBeenCalledOnce();
  });

  it("reuses the same memoized provider instance on subsequent calls with the same role, avoiding redundant STS assume role calls", () => {
    const cacheTest = {
      ...baseOptions,
      roleArn: "arn:aws:iam::222222222222:role/memoization-test",
    };

    createSigv4FetchWithCredentials(cacheTest);
    createSigv4FetchWithCredentials(cacheTest);

    expect(fromTemporaryCredentials).toHaveBeenCalledOnce();
    expect(memoize).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: "no externalId",
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
      name: "with externalId",
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
  ])(
    "passes correct STS assume-role config to fromTemporaryCredentials when $name",
    ({ options, expectedParams }) => {
      createSigv4FetchWithCredentials(options);
      expect(fromTemporaryCredentials).toHaveBeenCalledWith({
        clientConfig: {
          region: baseOptions.region,
        },
        params: expectedParams,
      });
    },
  );

  it("creates a separate memoized provider per unique role ARN and externalId combination", () => {
    const roleA = "arn:aws:iam::444444444444:role/separate-role-a";
    const roleB = "arn:aws:iam::555555555555:role/separate-role-b";

    createSigv4FetchWithCredentials({
      ...baseOptions,
      roleArn: roleA,
    });
    createSigv4FetchWithCredentials({
      ...baseOptions,
      roleArn: roleB,
    });
    createSigv4FetchWithCredentials({
      ...baseOptions,
      roleArn: roleA,
    });

    expect(fromTemporaryCredentials).toHaveBeenCalledTimes(2);
    expect(memoize).toHaveBeenCalledTimes(2);
  });

  describe("isExpired predicate", () => {
    function getIsExpired(roleArn: string) {
      createSigv4FetchWithCredentials({ ...baseOptions, roleArn });
      const call = vi.mocked(memoize).mock.calls[0];
      if (!call) throw new Error("memoize was not called");
      return call[1] as (creds: AwsCredentialIdentity) => boolean;
    }

    it("returns true when expiration is in the past", () => {
      const isExpired = getIsExpired("arn:aws:iam::601000000000:role/expired");
      expect(
        isExpired({
          accessKeyId: "k",
          secretAccessKey: "s",
          expiration: new Date(Date.now() - 1000),
        }),
      ).toBe(true);
    });

    it("returns true when expiration is within the 5-minute buffer", () => {
      const isExpired = getIsExpired(
        "arn:aws:iam::601500000000:role/near-expiry",
      );
      expect(
        isExpired({
          accessKeyId: "k",
          secretAccessKey: "s",
          expiration: new Date(Date.now() + 299_000),
        }),
      ).toBe(true);
    });

    it("returns false when expiration is more than 5 minutes away", () => {
      const isExpired = getIsExpired("arn:aws:iam::602000000000:role/valid");
      expect(
        isExpired({
          accessKeyId: "k",
          secretAccessKey: "s",
          expiration: new Date(Date.now() + 600_000),
        }),
      ).toBe(false);
    });

    it("returns false when expiration is undefined", () => {
      const isExpired = getIsExpired(
        "arn:aws:iam::603000000000:role/no-expiry",
      );
      expect(isExpired({ accessKeyId: "k", secretAccessKey: "s" })).toBe(false);
    });
  });

  describe("requiresRefresh predicate", () => {
    function getRequiresRefresh(roleArn: string) {
      createSigv4FetchWithCredentials({ ...baseOptions, roleArn });
      const call = vi.mocked(memoize).mock.calls[0];
      if (!call) throw new Error("memoize was not called");
      return call[2] as (creds: AwsCredentialIdentity) => boolean;
    }

    it("returns true when credentials have an expiry", () => {
      const requiresRefresh = getRequiresRefresh(
        "arn:aws:iam::701000000000:role/has-expiry",
      );
      expect(
        requiresRefresh({
          accessKeyId: "k",
          secretAccessKey: "s",
          expiration: new Date(Date.now() + 3_600_000),
        }),
      ).toBe(true);
    });

    it("returns false when expiration is undefined", () => {
      const requiresRefresh = getRequiresRefresh(
        "arn:aws:iam::703000000000:role/no-expiry",
      );
      expect(requiresRefresh({ accessKeyId: "k", secretAccessKey: "s" })).toBe(
        false,
      );
    });
  });

  it("logs an info message when STS credentials are refreshed", async () => {
    createSigv4FetchWithCredentials({
      ...baseOptions,
      roleArn: "arn:aws:iam::800000000000:role/logging-test",
    });

    const call = vi.mocked(memoize).mock.calls[0];
    if (!call) throw new Error("memoize was not called");
    const loggingProvider = call[0] as () => Promise<AwsCredentialIdentity>;
    await loggingProvider();

    expect(logger.info).toHaveBeenCalledWith(
      "STS credentials refreshed",
      expect.any(Object),
    );
  });
});
