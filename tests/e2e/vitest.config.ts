import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/setup.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
    },
  },
});
