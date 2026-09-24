import { config } from "@flex/config/eslint";

export default [
  ...config,
  {
    files: [
      "src/fixtures/dynamo.ts",
      "src/fixtures/dynamo.test.ts",
      "src/fixtures/secret.ts",
    ],
    rules: {
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
];
