import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-lambda-powertools/parameters/secrets");
vi.mock("@flex/logging");

import { getSecret } from "@aws-lambda-powertools/parameters/secrets";

import { handler } from "./jwks-endpoint";

describe("JWKS Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with JWKS when secret is valid", async () => {
    vi.mocked(getSecret).mockResolvedValue({ n: "test-n-value", kid: "test-kid" } as never);

    const result = await handler();

    expect(result).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keys: [
          {
            alg: "RS256",
            e: "AQAB",
            kty: "RSA",
            n: "test-n-value",
            use: "sig",
            kid: "test-kid",
          },
        ],
      }),
    });
  });

  it("returns 500 when getSecret throws", async () => {
    vi.mocked(getSecret).mockRejectedValue(new Error("Secrets Manager error"));

    const result = await handler();

    expect(result).toEqual({
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal Server Error" }),
    });
  });

  it("returns 500 when secret fails schema validation", async () => {
    vi.mocked(getSecret).mockResolvedValue({ unexpected: "shape" } as never);

    const result = await handler();

    expect(result).toEqual({
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal Server Error" }),
    });
  });
});
