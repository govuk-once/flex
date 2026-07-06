import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      setupFiles: ["@flex/testing/setup/service-gateway"],
      env: {
        AWS_REGION: "eu-west-2",
      },
    },
  }),
);
