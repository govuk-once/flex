import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        AWS_REGION: "eu-west-2",
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        unsFlexPrivateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        udpNotificationSecret: "test-notification-name", // pragma: allowlist secret
        unsCustomerRole: "arn:aws:iam::123456789012:role/uns-customer-role", // pragma: allowlist secret
      },
    },
  }),
);
