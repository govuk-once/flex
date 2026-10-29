import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      setupFiles: ["@flex/testing/setup/platform"],
      env: {
        FLEX_GATEWAY_NAME: "example",
      },
    },
  }),
);
