import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: ["@flex/testing/setup/platform"],
      env: {
        AWS_REGION: "eu-west-2",
        FLEX_GATEWAY_NAME: "udp",
      },
    },
  }),
);
