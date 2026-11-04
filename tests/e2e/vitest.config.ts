import { baseConfig } from "@flex/config/vitest/base";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      globalSetup: "@flex/testing/e2e/setup",
      testTimeout: 40_000,
    },
  }),
);
