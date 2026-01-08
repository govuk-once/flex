import js from "@eslint/js";
import html from "@html-eslint/eslint-plugin";
import onlyWarn from "eslint-plugin-only-warn";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const codeFiles = ["**/*.ts", "**/*.js", "**/*.mjs"];
const htmlFiles = ["**/*.html"];

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  {
    files: codeFiles,
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommendedTypeChecked.map((conf) => ({
    files: codeFiles,
    ...conf,
  })),
  {
    files: codeFiles,
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      onlyWarn,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-floating-promises": ["error"],
    },
    ignores: ["dist/**", "**/*.html"],
  },
  {
    files: htmlFiles,
    plugins: {
      html,
    },
    language: "html/html",
    rules: {
      "no-irregular-whitespace": "off",
    },
  },
  eslintPluginPrettierRecommended,
];
