import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, mergeConfig } from "vitest/config";

// @ts-expect-error: TS complains about the .ts extension, but Node ESM requires it
import { config as baseConfig } from "./vitest.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const e2eConfig = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      globalSetup: resolve(__dirname, "./e2e.setup.global.ts"),
    },
  }),
);
