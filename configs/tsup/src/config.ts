import { defineConfig } from "tsup";

export const config = defineConfig({
  entry: [
    "src/**/get.ts",
    "src/**/post.ts",
    "src/**/put.ts",
    "src/**/delete.ts",
  ],
  format: "esm",
  splitting: false,
  sourcemap: true,
  minify: true,
  clean: true,
  noExternal: [/(.*)/], // Force single file bundle
});
