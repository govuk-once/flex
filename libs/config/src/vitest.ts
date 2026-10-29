import { baseConfig } from "@flex/config/vitest/base";
import { defineConfig, mergeConfig } from "vitest/config";

/**
 * Shared base config for unit tests. E2E tests use `@flex/config/vitest/e2e`
 * instead, so they never see these dummy AWS values.
 */
export const config = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Dummy credentials so SigV4 signing never touches the real provider chain.
      // Packages can override these via `test.env` in their own vitest config.
      env: {
        AWS_REGION: "eu-west-2",
        AWS_ACCESS_KEY_ID: "test",
        AWS_SECRET_ACCESS_KEY: "test", // pragma: allowlist secret
        // The SDK prefers AWS_PROFILE over the keys above, so blank any profile from the shell.
        AWS_PROFILE: "",
      },
    },
  }),
);
