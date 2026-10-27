import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...(configDefaults as { exclude: string[] }).exclude, "e2e/**"],
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        AWS_REGION: "eu-west-2",
        AWS_ACCESS_KEY_ID: "test", // pragma: allowlist secret
        AWS_SECRET_ACCESS_KEY: "test", // pragma: allowlist secret
        // One entry per resource the domain declares. Step 4 adds this one.
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
      },
    },
  }),
);
