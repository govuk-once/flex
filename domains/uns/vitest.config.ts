import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        unsFlexPrivateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        udpNotificationSecret: "test-notification-name", // pragma: allowlist secret
        unsCustomerRole: "arn:aws:iam::123456789012:role/uns-customer-role", // pragma: allowlist secret
        encryptionKey: "arn:aws:kms:eu-west-2:123456789012:key/test-key",
      },
    },
  }),
);
