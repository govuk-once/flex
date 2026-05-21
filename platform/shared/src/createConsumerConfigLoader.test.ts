import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createConsumerConfigLoader } from "./createConsumerConfigLoader";

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: vi.fn(),
}));

import { getSecret } from "@aws-lambda-powertools/parameters/secrets";

const mockGetSecret = vi.mocked(getSecret) as unknown as ReturnType<
  typeof vi.fn
>;

const testSchema = z.object({
  apiUrl: z.string().min(1),
  apiKey: z.string().min(1),
});

const SECRET_ARN = "arn:aws:secretsmanager:eu-west-2:123:secret:test"; // pragma: allowlist secret

describe("createConsumerConfigLoader", () => {
  it("returns parsed config when secret exists and matches schema", async () => {
    mockGetSecret.mockResolvedValue({
      apiUrl: "https://api.test",
      apiKey: "key", // pragma: allowlist secret
    });

    const load = createConsumerConfigLoader(testSchema);
    const result = await load(SECRET_ARN);

    expect(result).toEqual({ apiUrl: "https://api.test", apiKey: "key" }); // pragma: allowlist secret
    expect(getSecret).toHaveBeenCalledWith(SECRET_ARN, {
      transform: "json",
      maxAge: 600,
    });
  });

  it("throws when the secret is null", async () => {
    mockGetSecret.mockResolvedValue(null);

    const load = createConsumerConfigLoader(testSchema);
    await expect(load(SECRET_ARN)).rejects.toThrow("Consumer config not found");
  });

  it("throws when the secret is undefined", async () => {
    mockGetSecret.mockResolvedValue(undefined);

    const load = createConsumerConfigLoader(testSchema);
    await expect(load(SECRET_ARN)).rejects.toThrow("Consumer config not found");
  });

  it("throws when the secret fails schema validation", async () => {
    mockGetSecret.mockResolvedValue({ apiUrl: "", apiKey: "key" }); // pragma: allowlist secret

    const load = createConsumerConfigLoader(testSchema);
    await expect(load(SECRET_ARN)).rejects.toThrow();
  });

  it("creates independent loaders for different schemas", async () => {
    const schemaA = z.object({ token: z.string() });
    const schemaB = z.object({ apiUrl: z.string(), apiKey: z.string() }); // pragma: allowlist secret

    mockGetSecret.mockResolvedValue({ token: "tok" });
    const loadA = createConsumerConfigLoader(schemaA);
    await expect(loadA(SECRET_ARN)).resolves.toEqual({ token: "tok" });

    mockGetSecret.mockResolvedValue({ apiUrl: "u", apiKey: "k" }); // pragma: allowlist secret
    const loadB = createConsumerConfigLoader(schemaB);
    await expect(loadB(SECRET_ARN)).resolves.toEqual({
      apiUrl: "u",
      apiKey: "k", // pragma: allowlist secret
    });
  });
});
