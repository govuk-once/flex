import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
    },
    exclude: ['**/node_modules/**', '**/dist/**'],
    projects: [
      {
        extends: true,
        test: {
          include: ["**/tests/e2e/**/*.test.ts"],
          name: "e2e",
        },
      },
      {
        test: {
          exclude: ["**/tests/e2e/**"],
          name: "unit",
        },
        extends: true,
      },
    ],
  },
});
