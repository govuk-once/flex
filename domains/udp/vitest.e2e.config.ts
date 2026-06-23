import { e2eConfig } from "@flex/config/vitest/e2e";
import { defineConfig, mergeConfig } from "vitest/config";

// UDP's E2E calls are slow enough to need a longer timeout than the default.
export default mergeConfig(
  e2eConfig,
  defineConfig({
    test: {
      testTimeout: 40_000,
    },
  }),
);
