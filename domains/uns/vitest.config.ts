import { config } from "@flex/config/vitest";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
    test: {
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        AWS_REGION: "eu-west-2",
      },
    },
  }),
);
