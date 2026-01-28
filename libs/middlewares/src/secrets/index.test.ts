import { it } from "@flex/testing";
import secretsManager, { secret } from "@middy/secrets-manager";
import { describe, expect, vi } from "vitest";

import { createSecretsMiddleware } from ".";

vi.mock("@middy/secrets-manager", () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue({} as unknown),
  secret: vi.fn((id: string) => ({ id })),
}));

describe("createSecretsMiddleware", () => {
  it("creates a secrets manager middleware with the expected fetchData config", () => {
    const secrets = {
      secretKey: "my-secret-id", // pragma: allowlist secret
      anotherSecret: "another-secret-id", // pragma: allowlist secret
    };

    createSecretsMiddleware<typeof secrets>({ secrets });

    expect(secretsManager).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchData: {
          secretKey: {
            id: secrets.secretKey,
          },
          anotherSecret: {
            id: secrets.anotherSecret,
          },
        },
        setToContext: true,
      }),
    );
    expect(secret).toHaveBeenCalledWith("my-secret-id");
    expect(secret).toHaveBeenCalledWith("another-secret-id");
  });

  it("throws an error when a secret id is undefined", () => {
    const secrets: Record<string, string | undefined> = {
      definedSecret: "defined-id", // pragma: allowlist secret
      undefinedSecret: undefined,
    };

    expect(() =>
      createSecretsMiddleware<Record<string, string | undefined>>({
        secrets,
      }),
    ).toThrow('Secret id for "undefinedSecret" is not defined');
  });

  it("passes options through to secretsManager", () => {
    const secrets = {
      secretKey: "my-secret-id", // pragma: allowlist secret
    };
    const options = {
      awsClientOptions: {
        region: "eu-west-2",
      },
      cacheExpiry: 60000,
      cacheKey: "custom-cache-key",
    };

    createSecretsMiddleware<typeof secrets>({ secrets, options });

    expect(secretsManager).toHaveBeenCalledWith(
      expect.objectContaining({
        ...options,
        fetchData: {
          secretKey: {
            id: secrets.secretKey,
          },
        },
        setToContext: true,
      }),
    );
  });

  it("ensures fetchData and setToContext take precedence over options", () => {
    const secrets = {
      secretKey: "my-secret-id", // pragma: allowlist secret
    };
    const options = {
      fetchData: {} as never, // This should be ignored
      setToContext: false as never, // This should be ignored
      cacheExpiry: 60000,
    };

    createSecretsMiddleware<typeof secrets>({ secrets, options });

    expect(secretsManager).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheExpiry: 60000,
        fetchData: {
          secretKey: {
            id: secrets.secretKey,
          },
        },
        setToContext: true,
      }),
    );
  });
});
