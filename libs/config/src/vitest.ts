import { defineConfig } from "vitest/config";

export const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
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
