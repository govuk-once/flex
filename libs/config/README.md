# @flex/config

This package provides shared configurations for projects within this monorepo.

Its goal is to ensure consistent linting rules, code style, and best practices across all projects. All projects in this monorepo are expected to consume these configs rather than defining their own.

Currently this config supports the following files for linting:

- TypeScript **(.ts)**
- JavaScript **(.js, .mjs)**
- HTML **(.html)**
- JSON **(.json)**
- Markdown **(.md)**

---

## Usage

Each project should create its own `eslint.config.mjs` and `tsconfig.json`. Optionally `vitest.config.ts` if tests are required.

#### ESLint

```js
import { config } from "@flex/config/eslint";

export default config;
```

#### TypeScript

```json
{
  "extends": "@flex/config/tsconfig.json",
  "include": ["src/**/*.ts", "eslint.config.mjs", "vitest.config.ts"]
}
```

**Note**: Only include `vitest.config.ts` if also adding the vitest config.

#### Vitest

```ts
import { config } from "@flex/config/vitest";

export default config;
```

---

## Installation

Projects can reference it directly via the workspace package name. Also include the latest version of the required peer dependencies.

```json
"devDependencies": {
  "@flex/config": "workspace:*",
  "eslint": "9.39.2",
  "typescript": "5.9.3",
  "vitest": "4.0.16"
}
```
