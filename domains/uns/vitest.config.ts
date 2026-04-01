import { config } from "@flex/config/vitest";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
    test: {
      setupFiles: ["@flex/testing/setup/sdk", "./src/test/setup.ts"],
      env: {
        AWS_REGION: "eu-west-2",
        flexPrivateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        unsNotificationSecret: "/flex-secret/uns/notification-hash-secret", // pragma: allowlist secret
      },
    },
  }),
);
