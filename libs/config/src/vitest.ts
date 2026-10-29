import { defineConfig } from "vitest/config";

export const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Dummy credentials so SigV4 signing never touches the real provider chain.
    // Packages can override these via `test.env` in their own vitest config.
    env: {
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test", // pragma: allowlist secret
      // The SDK prefers AWS_PROFILE over the keys above, so blank any profile from the shell.
      AWS_PROFILE: "",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/__mocks__/**",
        "src/**/__tests__/**",
      ],
    },
  },
});
