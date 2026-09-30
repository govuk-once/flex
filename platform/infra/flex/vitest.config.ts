import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  }),
);
