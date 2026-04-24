import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        AWS_REGION: "eu-west-2",
        unsNotificationSecret: "/flex-secret/uns/notification-hash-secret",
        flexPrivateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
      },
    },
  }),
);
