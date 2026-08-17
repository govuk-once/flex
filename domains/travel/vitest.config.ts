import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        AWS_REGION: "eu-west-2",
        // Integrations are SigV4-signed by the real signer, which needs
        // credentials present before nock can intercept the request.
        AWS_ACCESS_KEY_ID: "test-access-key-id", // pragma: allowlist secret
        AWS_SECRET_ACCESS_KEY: "test-secret-access-key", // pragma: allowlist secret
        flexPrivateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
      },
    },
  }),
);
