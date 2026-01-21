import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import html from "@html-eslint/eslint-plugin";
import { readGitignoreFiles } from "eslint-gitignore";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { findUpSync } from "find-up";
import tseslint from "typescript-eslint";

const flattenedTsConfigRules = tseslint.configs.recommendedTypeChecked.reduce(
  (acc, obj) => Object.assign(acc, obj.rules),
  {},
);

/**
 * @param {string} f - The filename to search for.
 * @returns {string | undefined} The directory path containing the file.
 */
const findUpFileDir = (f) => findUpSync(f).slice(0, -f.length);
const gitignoreFiles = readGitignoreFiles({ cwd: findUpFileDir(".gitignore") });

/**
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  {
    ignores: gitignoreFiles,
  },
  {
    files: ["**/*.ts", "**/*.js", "**/*.mjs"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...flattenedTsConfigRules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-floating-promises": ["error"],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: ["**/*.html"],
    plugins: {
      html,
    },
    language: "html/html",
    rules: {
      "no-irregular-whitespace": "off",
    },
  },
  {
    files: ["**/*.json"],
    language: "json/json",
    plugins: {
      json,
    },
    rules: {
      "json/no-duplicate-keys": "error",
    },
  },
  {
    files: ["**/*.md"],
    plugins: {
      markdown,
    },
    language: "markdown/commonmark",
    rules: {
      "markdown/no-html": "error",
    },
  },
  eslintPluginPrettierRecommended,
];
