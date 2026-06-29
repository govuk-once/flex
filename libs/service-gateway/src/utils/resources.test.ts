import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { it } from "@flex/testing";
import { NonEmptyString } from "@flex/utils";
import type { Mock } from "vitest";
import { describe, expect, vi } from "vitest";
import { z } from "zod";

import type { KmsResource, RoleResource, SecretResource } from "../types";
import { resolveResources } from "./resources";

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: vi.fn(),
}));

const mockGetSecret = vi.mocked(getSecret) as unknown as Mock<
  (arn: string) => Promise<Record<string, unknown> | undefined>
>;

const mockSecretEnv = "FLEX_EXAMPLE_CONFIG_SECRET_ARN"; // pragma: allowlist secret
const mockSecretArn =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:example"; // pragma: allowlist secret
const mockSecretRawConfig = {
  apiKey: "test-api-key", // pragma: allowlist secret
  apiUrl: "https://api.example.com",
};

const configSchema = z.object({
  apiKey: NonEmptyString,
  apiUrl: NonEmptyString,
});
const mockSecretResource: SecretResource = {
  type: "secret",
  path: "/example/secret",
  env: mockSecretEnv,
  config: configSchema,
};
const mockKmsResource: KmsResource = { type: "kms", path: "/example/key" };
const mockRoleResource: RoleResource = { type: "role", path: "/example/role" };

describe("resolveResources", () => {
  it("returns a parsed secret resource", async ({ env }) => {
    env.set({ [mockSecretEnv]: mockSecretArn });

    mockGetSecret.mockResolvedValue(mockSecretRawConfig);

    const result = await resolveResources({
      consumerConfig: mockSecretResource,
    });

    expect(getSecret).toHaveBeenCalledExactlyOnceWith(mockSecretArn, {
      maxAge: 600,
      transform: "json",
    });
    expect(result).toStrictEqual({ consumerConfig: mockSecretRawConfig });
  });

  it("removes all fields not defined in the schema", async ({ env }) => {
    env.set({ [mockSecretEnv]: mockSecretArn });

    mockGetSecret.mockResolvedValue({
      ...mockSecretRawConfig,
      key: "value",
    });

    const result = await resolveResources({
      consumerConfig: mockSecretResource,
    });

    expect(result).toStrictEqual({ consumerConfig: mockSecretRawConfig });
  });

  it("ignores all non-secret resources", async ({ env }) => {
    env.set({ [mockSecretEnv]: mockSecretArn });

    mockGetSecret.mockResolvedValue(mockSecretRawConfig);

    const result = await resolveResources({
      consumerConfig: mockSecretResource,
      kms: mockKmsResource,
      role: mockRoleResource,
    });

    expect(getSecret).toHaveBeenCalledOnce();
    expect(result).toStrictEqual({ consumerConfig: mockSecretRawConfig });
  });

  it("returns an empty object when no resolvable resources exist", async () => {
    const result = await resolveResources({
      kms: mockKmsResource,
      role: mockRoleResource,
    });

    expect(getSecret).not.toHaveBeenCalled();
    expect(result).toStrictEqual({});
  });

  it("resolves multiple resources", async ({ env }) => {
    const mockTestArn = "arn:aws:secretsmanager:eu-west-2:123456789012:test"; // pragma: allowlist secret
    const mockTestEnv = "FLEX_SECOND_CONFIG_SECRET_ARN"; // pragma: allowlist secret
    const mockTestRawConfig = {
      apiKey: "second-key", // pragma: allowlist secret
      apiUrl: "https://second.example.com",
    };

    env.set({ [mockSecretEnv]: mockSecretArn, [mockTestEnv]: mockTestArn });

    mockGetSecret.mockImplementation((arn) =>
      Promise.resolve(
        arn === mockSecretArn ? mockSecretRawConfig : mockTestRawConfig,
      ),
    );

    const result = await resolveResources({
      consumerConfig: mockSecretResource,
      testConfig: { ...mockSecretResource, env: mockTestEnv },
    });

    expect(result).toStrictEqual({
      consumerConfig: mockSecretRawConfig,
      testConfig: mockTestRawConfig,
    });
  });

  it("throws when an unknown resource type is provided", async () => {
    await expect(
      resolveResources({
        resource: { type: "unknown", path: "/example/unknown" } as never,
      }),
    ).rejects.toThrow();
  });

  it("throws when the resource environment variable is not set", async ({
    env,
  }) => {
    env.delete(mockSecretEnv);

    await expect(
      resolveResources({ consumerConfig: mockSecretResource }),
    ).rejects.toThrow(
      `Environment variable "${mockSecretEnv}" is not set, check if "${mockSecretResource.path}" exists`,
    );
  });

  it("throws when the secret is not found", async ({ env }) => {
    env.set({ [mockSecretEnv]: mockSecretArn });

    mockGetSecret.mockResolvedValue(undefined);

    await expect(
      resolveResources({ consumerConfig: mockSecretResource }),
    ).rejects.toThrow(`Secret not found: "${mockSecretArn}"`);
  });
});
