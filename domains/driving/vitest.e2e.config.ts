import { e2eConfig } from "@flex/config/vitest/e2e";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  e2eConfig,
  defineConfig({
    test: {
      testTimeout: 20000,
    },
  }),
);
