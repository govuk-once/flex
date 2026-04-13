import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import html from "@html-eslint/eslint-plugin";
import vitest from "@vitest/eslint-plugin";
import { readGitignoreFiles } from "eslint-gitignore";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { findUpSync } from "find-up";
import globals from "globals";
import tseslint from "typescript-eslint";

const flattenedTsConfigRules = tseslint.configs.strictTypeChecked.reduce(
  (acc, obj) => Object.assign(acc, obj.rules),
  {},
);

// @ts-expect-error
const findUpFileDir = (f) => findUpSync(f)?.slice(0, -f.length);
const gitignoreFiles = readGitignoreFiles({ cwd: findUpFileDir(".gitignore") });

/**
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  {
    ignores: gitignoreFiles,
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "simple-import-sort": simpleImportSort,
    },
    // @ts-expect-error return type for flattenedTsConfigRules is valid can ignore
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
    files: ["**/*.tsx"],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ["**/*.tsx"],
    ...reactHooks.configs.flat.recommended,
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
      // @ts-expect-error issue within "@eslint/json" not our own
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
  {
    files: ["tests/**", "**/*.test.ts"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/unbound-method": "off",
      "vitest/no-standalone-expect": "off",
      "vitest/no-focused-tests": ["error", { fixable: false }],
    },
    settings: {
      vitest: { vitestImports: ["@flex/e2e", "@flex/testing"] },
    },
  },
  eslintPluginPrettierRecommended,
];
