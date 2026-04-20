import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        AWS_REGION: "eu-west-2",
        encryptionKeyArn: "arn:aws:kms:eu-west-2:123456789012:key/test-key",
        flexPrivateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        flexDvlaTestUser: "test-user",
      },
    },
  }),
);
