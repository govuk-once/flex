import { afterEach, describe, expect, it, vi } from "vitest";

async function loadForStage(stage: string) {
  vi.resetModules();
  vi.stubEnv("STAGE", stage);
  const { getAuthorizerParameterKeys } = await import("./auth-parameters");
  return getAuthorizerParameterKeys();
}

describe("getAuthorizerParameterKeys", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the stub Cognito parameters in development", async () => {
    await expect(loadForStage("development")).resolves.toEqual({
      userPoolId: "/development/flex-param/auth/stub/user-pool-id",
      clientId: "/development/flex-param/auth/stub/client-id",
    });
  });

  it("uses the stub parameters for a personal or PR stage in the development account", async () => {
    await expect(loadForStage("pr-123")).resolves.toEqual({
      userPoolId: "/development/flex-param/auth/stub/user-pool-id",
      clientId: "/development/flex-param/auth/stub/client-id",
    });
  });

  it.each(["staging", "production"])(
    "uses the real Cognito parameters in %s",
    async (stage) => {
      await expect(loadForStage(stage)).resolves.toEqual({
        userPoolId: `/${stage}/flex-param/auth/user-pool-id`,
        clientId: `/${stage}/flex-param/auth/client-id`,
      });
    },
  );
});
