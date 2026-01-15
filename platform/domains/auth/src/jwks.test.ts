import { afterEach, describe, expect, it, vi } from "vitest";

import { callCognitoJwksEndpoint } from "./jwks";

declare global {
  // Allow overriding global fetch in tests

  // @ts-expect-error - restore to undefined for test isolation
  var fetch:
    | ((input: string | URL | Request, init?: RequestInit) => Promise<Response>)
    | undefined;
}

describe("JWKS integration", () => {
  const userPoolId = "user-pool-id";
  const region = "eu-west-2";

  afterEach(() => {
    vi.resetAllMocks();
    // Reset global fetch between scenarios

    if (globalThis.fetch) {
      // @ts-expect-error - restore to undefined for test isolation
      globalThis.fetch = undefined;
    }
  });

  it("calls the dummy JWKS endpoint and returns the parsed JWKS payload", async () => {
    const jwksPayload = { keys: [{ kid: "dummy-key-id" }] };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => Promise.resolve(jwksPayload),
    } as Response);

    globalThis.fetch = fetchMock;

    const result = await callCognitoJwksEndpoint(userPoolId, region);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
      {
        method: "GET",
      },
    );
    expect(result).toEqual(jwksPayload);
  });

  it("throws a descriptive error when the JWKS endpoint response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => Promise.resolve({}),
    } as Response);

    globalThis.fetch = fetchMock;

    await expect(callCognitoJwksEndpoint(userPoolId, region)).rejects.toThrow(
      "Failed to fetch JWKS from Cognito JWKS endpoint: 500 Internal Server Error",
    );
  });

  it("throws when fetch is not available in the runtime", async () => {
    // Ensure fetch is not defined
    // @ts-expect-error - restore to undefined for test isolation
    globalThis.fetch = undefined;

    await expect(callCognitoJwksEndpoint(userPoolId, region)).rejects.toThrow(
      "Global fetch API is not available in this runtime",
    );
  });
});
