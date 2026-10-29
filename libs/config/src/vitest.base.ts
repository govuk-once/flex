import { defineConfig } from "vitest/config";

/**
 * Settings common to every Vitest run. Use `@flex/config/vitest` for unit
 * tests and `@flex/config/vitest/e2e` for E2E tests, both of which extend this.
 */
export const baseConfig = defineConfig({
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
