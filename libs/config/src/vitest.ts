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
    },
  },
});
