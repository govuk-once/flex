import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      globalSetup: "./src/setup.global.ts",
      testTimeout: 50_000,
    },
  }),
);
