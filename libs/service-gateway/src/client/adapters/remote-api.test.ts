import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { typedFetch } from "@flex/flex-fetch";
import { it } from "@flex/testing";
import { extractQueryParams } from "@flex/utils";
import type {
  GatewayResources,
  RemoteApiDownstream,
  RemoteApiRequest,
} from "@types";
import type { Mock } from "vitest";
import { describe, expect, vi } from "vitest";
import z from "zod";

import { buildFetcher } from "../fetchers/build-fetcher";
import { createRemoteApiClient } from "./remote-api";

vi.mock("@flex/flex-fetch", () => ({ typedFetch: vi.fn() }));
vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: vi.fn(),
}));
vi.mock("../fetchers/build-fetcher");

const mockGetSecret = vi.mocked(getSecret) as unknown as Mock<
  () => Promise<Record<string, unknown> | undefined>
>;

const buildMockFetcher = (request = Promise.resolve(new Response())) => {
  const fetcher = vi.fn(() => ({ request, abort: vi.fn() }));
  vi.mocked(buildFetcher).mockReturnValue(fetcher);
  return { fetcher, request };
};

const SECRET_ENV = "FLEX_EXAMPLE_CONSUMER_CONFIG_SECRET_ARN"; // pragma: allowlist secret
const SECRET_PATH = "/example/secret"; // pragma: allowlist secret
const secretArn =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:example"; // pragma: allowlist secret

const rawConfig = {
  apiUrl: "https://api.example.com",
  apiKey: "test-api-key", // pragma: allowlist secret
} as const;

const downstream: RemoteApiDownstream = {
  type: "remote-api",
  ref: "consumerConfig",
  auth: { type: "public" },
};

const resources = {
  consumerConfig: { type: "secret", path: SECRET_PATH, env: SECRET_ENV },
} satisfies GatewayResources;

describe("createRemoteApiClient", () => {
  it("returns a remote api client instance", async ({ env }) => {
    env.set({ [SECRET_ENV]: secretArn });

    mockGetSecret.mockResolvedValue(rawConfig);

    const client = await createRemoteApiClient(downstream, resources);

    expect(getSecret).toHaveBeenCalledExactlyOnceWith(secretArn, {
      maxAge: 600,
      transform: "json",
    });
    expect(buildFetcher).toHaveBeenCalledExactlyOnceWith(rawConfig, {
      type: "public",
    });
    expect(client.config).toStrictEqual(rawConfig);
  });

  it("parses the raw config using the resource schema when provided", async ({
    env,
  }) => {
    env.set({ [SECRET_ENV]: secretArn });

    buildMockFetcher();
    mockGetSecret.mockResolvedValue(rawConfig);

    const resources = {
      consumerConfig: {
        type: "secret",
        path: SECRET_PATH,
        env: SECRET_ENV,
        config: z.object({ apiUrl: z.string() }),
      },
    } satisfies GatewayResources;

    const client = await createRemoteApiClient(downstream, resources);

    const parsedConfig = { apiUrl: "https://api.example.com" };

    expect(client.config).toStrictEqual(parsedConfig);
    expect(buildFetcher).toHaveBeenCalledExactlyOnceWith(parsedConfig, {
      type: "public",
    });
  });

  it.for<{ reason: string; ref: string; resources: GatewayResources }>([
    {
      reason: "the ref does not match any resource",
      ref: "unknown",
      resources: {},
    },
    {
      reason: "a secret resource does not exist",
      ref: "encryptionKey",
      resources: { testKey: { type: "kms", path: "/example/path" } },
    },
  ])("throws when $reason", async ({ ref, resources: refResources }) => {
    await expect(
      createRemoteApiClient({ ...downstream, ref }, refResources),
    ).rejects.toThrow(
      `downstream "ref" must reference a "secret" resource: "${ref}"`,
    );
  });

  it('throws when a resource "env" has not been provided', async () => {
    await expect(
      createRemoteApiClient(downstream, {
        consumerConfig: { type: "secret", path: SECRET_PATH },
      }),
    ).rejects.toThrow(
      `Resource "env" is missing and cannot be resolved: "${SECRET_PATH}"`,
    );
  });

  it("throws when the downstream resource environment variable is not set", async ({
    env,
  }) => {
    env.delete(SECRET_ENV);

    await expect(createRemoteApiClient(downstream, resources)).rejects.toThrow(
      `Environment variable "${SECRET_ENV}" is not set`,
    );
  });

  it("throws when the downstream config does not exist", async ({ env }) => {
    env.set({ [SECRET_ENV]: secretArn });

    mockGetSecret.mockResolvedValue(undefined);

    await expect(createRemoteApiClient(downstream, resources)).rejects.toThrow(
      `Downstream config not found: "${secretArn}"`,
    );
  });

  it.for<{
    reason: string;
    input: RemoteApiRequest;
    url: string;
    options: Record<string, unknown>;
  }>([
    {
      reason: "where a query string and body have not been provided",
      input: { method: "GET", path: "/v1/example" },
      url: "/v1/example",
      options: {
        method: "GET",
        headers: { Accept: "application/json" },
        body: undefined,
      },
    },
    {
      reason: "where a query string has been provided",
      input: {
        method: "GET",
        path: "/v1/example",
        query: { testQuery: "abc123" },
      },
      url: `/v1/example?${extractQueryParams({ testQuery: "abc123" })[0]}`,
      options: {
        method: "GET",
        headers: { Accept: "application/json" },
        body: undefined,
      },
    },
    {
      reason: "where a body and merged headers have been provided",
      input: {
        method: "POST",
        path: "/v1/example",
        body: { key: "value" },
        headers: { "x-test-key": "test-key" }, // pragma: allowlist secret
      },
      url: "/v1/example",
      options: {
        method: "POST",
        headers: { Accept: "application/json", "x-test-key": "test-key" },
        body: JSON.stringify({ key: "value" }),
      },
    },
  ])("sends a request $reason", async ({ input, url, options }, { env }) => {
    env.set({ [SECRET_ENV]: secretArn });

    vi.mocked(typedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      data: {},
    });

    mockGetSecret.mockResolvedValue(rawConfig);
    const { fetcher } = buildMockFetcher();

    const client = await createRemoteApiClient(downstream, resources);

    await client.request(input);

    expect(fetcher).toHaveBeenCalledExactlyOnceWith(url, options);
  });

  it("returns the API response", async ({ env }) => {
    env.set({ [SECRET_ENV]: secretArn });

    vi.mocked(typedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      data: {},
    });

    mockGetSecret.mockResolvedValue(rawConfig);

    const { request } = buildMockFetcher();

    const client = await createRemoteApiClient(downstream, resources);
    const result = await client.request({ method: "GET", path: "/v1/example" });

    expect(typedFetch).toHaveBeenCalledExactlyOnceWith(request);
    expect(result).toStrictEqual({ ok: true, status: 200, data: {} });
  });
});
