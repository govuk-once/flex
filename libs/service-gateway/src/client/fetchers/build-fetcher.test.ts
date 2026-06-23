import { createSigv4FetchWithCredentials } from "@flex/flex-fetch";
import { describe, expect, it, vi } from "vitest";

import type { DownstreamAuth } from "../../types";
import { buildFetcher } from "./build-fetcher";
import { createPublicFetch } from "./public-fetcher";

const mockFetcher = vi.hoisted(() => vi.fn());

vi.mock("@flex/flex-fetch", () => ({
  createSigv4FetchWithCredentials: vi.fn(() => mockFetcher),
}));

vi.mock("./public-fetcher");

const publicAuth: DownstreamAuth = { type: "public" };
const publicConfig = { apiUrl: "https://api.example.com" };

const sigv4Auth: DownstreamAuth = {
  type: "sigv4",
  role: "consumerRole",
  roleName: "consumer-session",
};
const sigv4Config = {
  apiUrl: "https://api.example.com",
  region: "eu-west-2",
  roleArn: "arn:aws:iam::123456789012:role/example",
  externalId: "external-id",
};

describe("buildFetcher", () => {
  it("returns a public fetcher", () => {
    const fetcher = vi.fn();

    vi.mocked(createPublicFetch).mockReturnValue(fetcher);

    const result = buildFetcher(publicConfig, publicAuth);

    expect(createPublicFetch).toHaveBeenCalledExactlyOnceWith({
      baseUrl: publicConfig.apiUrl,
    });
    expect(result).toBe(fetcher);
  });

  it("returns a sigv4 fetcher", () => {
    const fetcher = vi.fn();

    vi.mocked(createSigv4FetchWithCredentials).mockReturnValue(fetcher);

    const result = buildFetcher(sigv4Config, sigv4Auth);

    expect(createSigv4FetchWithCredentials).toHaveBeenCalledExactlyOnceWith({
      baseUrl: sigv4Config.apiUrl,
      region: sigv4Config.region,
      roleArn: sigv4Config.roleArn,
      roleName: sigv4Auth.roleName,
      externalId: sigv4Config.externalId,
    });
    expect(result).toBe(fetcher);
  });

  it("returns a sigv4 fetcher without the external ID when it is not provided", () => {
    const { externalId: _, ...config } = sigv4Config;

    buildFetcher(config, sigv4Auth);

    expect(createSigv4FetchWithCredentials).toHaveBeenCalledExactlyOnceWith({
      baseUrl: config.apiUrl,
      region: config.region,
      roleArn: config.roleArn,
      roleName: sigv4Auth.roleName,
      externalId: undefined,
    });
  });

  it.for([
    { config: undefined, reason: "is missing" },
    { config: {}, reason: "does not include an api URL" },
  ])("throws when the public config $reason", ({ config }) => {
    expect(() => buildFetcher(config, publicAuth)).toThrow();
  });

  it.for([
    { config: undefined, reason: "is missing" },
    { config: {}, reason: "is empty" },
    {
      config: { ...sigv4Config, apiUrl: undefined },
      reason: "does not include an api URL",
    },
    {
      config: { ...sigv4Config, region: undefined },
      reason: "does not include a region",
    },
    {
      config: { ...sigv4Config, roleArn: undefined },
      reason: "does not include a role ARN",
    },
  ])("throws when the sigv4 config $reason", ({ config }) => {
    expect(() => buildFetcher(config, sigv4Auth)).toThrow();
  });

  it.for<DownstreamAuth["type"]>(["public", "sigv4"])(
    "throws when an unknown auth type is provided to a $type config",
    (type) => {
      expect(() =>
        buildFetcher(type === "public" ? publicConfig : sigv4Config, {
          type: "unknown" as never,
        }),
      ).toThrow();
    },
  );
});
