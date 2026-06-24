import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

/**
 * Shared base config for domain E2E suites. Domains re-export this as their
 * default. A domain whose E2E calls are slow can merge an override on top
 * (e.g. a longer `testTimeout`) rather than duplicating the whole config.
 */
export const e2eConfig = mergeConfig(
  config,
  defineConfig({
    test: {
      globalSetup: ["@flex/testing/e2e/setup"],
      include: ["e2e/**/*.test.ts"],
    },
  }),
);
