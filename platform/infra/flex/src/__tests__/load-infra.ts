import { vi } from "vitest";

export const TEST_ACCOUNT = "123456789012";

export async function loadInfra(stage: string) {
  vi.resetModules();
  vi.stubEnv("STAGE", stage);
  vi.stubEnv("CDK_DEFAULT_ACCOUNT", TEST_ACCOUNT);

  const [{ SsmApp }, keys] = await Promise.all([
    import("../base"),
    import("../ssm-keys"),
  ]);

  return { SsmApp, ...keys };
}
