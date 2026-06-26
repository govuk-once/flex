import { createSigv4FetchWithCredentials } from "@flex/sdk";
import { describe, expect, it, vi } from "vitest";

import type { RestAuth } from "./build";
import { buildFetcher } from "./build";
import { createPublicFetch } from "./public";

const mockSigv4Fetcher = vi.hoisted(() => vi.fn());
vi.mock("@flex/sdk", () => ({
  createSigv4FetchWithCredentials: vi.fn(() => mockSigv4Fetcher),
}));

vi.mock("./public");

describe("buildFetcher", () => {
  const baseUrl = "https://api.example.com";
  const region = "eu-west-2";
  const roleArn = "arn:aws:iam::123456789012:role/example";
  const roleName = "test-session";
  const externalId = "test-external-id";

  const publicAuth: RestAuth = { type: "public" };
  const sigv4Auth: RestAuth = {
    type: "sigv4",
    region,
    roleArn,
    roleName,
    externalId,
  };
  const fetcher = vi.fn();

  it("returns a public fetcher", () => {
    vi.mocked(createPublicFetch).mockReturnValue(fetcher);

    const result = buildFetcher({ baseUrl, auth: publicAuth });

    expect(createPublicFetch).toHaveBeenCalledExactlyOnceWith({ baseUrl });
    expect(result).toBe(fetcher);
  });

  it("returns a sigv4 fetcher", () => {
    vi.mocked(createSigv4FetchWithCredentials).mockReturnValue(fetcher);

    const result = buildFetcher({ baseUrl, auth: sigv4Auth });

    expect(createSigv4FetchWithCredentials).toHaveBeenCalledExactlyOnceWith({
      baseUrl,
      region,
      roleArn,
      roleName,
      externalId,
    });
    expect(result).toBe(fetcher);
  });

  it("omits the external ID when it is not provided", () => {
    buildFetcher({ baseUrl, auth: { ...sigv4Auth, externalId: undefined } });

    expect(createSigv4FetchWithCredentials).toHaveBeenCalledExactlyOnceWith({
      baseUrl,
      region,
      roleArn,
      roleName,
      externalId: undefined,
    });
  });

  it("throws when an unknown auth type is provided", () => {
    expect(() =>
      buildFetcher({ baseUrl, auth: { type: "unknown" } as never }),
    ).toThrow();
  });
});
