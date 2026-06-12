import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      globalSetup: ["@flex/testing/e2e/setup"],
      include: ["e2e/**/*.test.ts"],
      testTimeout: 40_000,
    },
  }),
);
