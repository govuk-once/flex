import { e2eConfig } from "@flex/config/vitest/e2e";
import { defineConfig, mergeConfig } from "vitest/config";

// UNS & UDP Tests have longer timeouts in their own domains - this should match that duration
export default mergeConfig(
  e2eConfig,
  defineConfig({
    test: {
      testTimeout: 40_000,
    },
  }),
);
