import path from "node:path";
import { fileURLToPath } from "node:url";

import { vi } from "vitest";

export const TEST_ACCOUNT = "123456789012";
export const FIXTURE_MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/signed-artifacts.fixture.json",
);

export async function loadInfra(stage: string) {
  vi.resetModules();
  vi.stubEnv("STAGE", stage);
  vi.stubEnv("CDK_DEFAULT_ACCOUNT", TEST_ACCOUNT);
  vi.stubEnv("SIGNED_ARTIFACTS_MANIFEST_PATH", FIXTURE_MANIFEST_PATH);

  const [{ SsmApp }, keys] = await Promise.all([
    import("../base"),
    import("../ssm-keys"),
  ]);

  return { SsmApp, ...keys };
}
