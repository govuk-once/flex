import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: ["@flex/testing/setup/service-gateway"],
      env: {
        AWS_REGION: "eu-west-2",
        AWS_ACCESS_KEY_ID: "test-access-key-id", // pragma: allowlist secret
        AWS_SECRET_ACCESS_KEY: "test-secret-access-key", // pragma: allowlist secret
      },
    },
  }),
);
