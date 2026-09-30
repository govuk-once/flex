import { config } from "@flex/config/eslint";
import { globalIgnores } from "eslint/config";

export default [
  ...config,
  globalIgnores(["**/vendor/**"]),
  {
    files: ["**/*.test.ts"],
    rules: {
      "vitest/expect-expect": [
        "error",
        {
          assertFunctionNames: [
            "expect",
            "**.hasResourceProperties",
            "**.resourceCountIs",
          ],
        },
      ],
    },
  },
];
