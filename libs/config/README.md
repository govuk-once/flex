# @flex/config

Shared configuration for ESLint, TypeScript and Vitest across FLEX.

This package ensures consistent linting rules, code style and type checking across all workspaces. All platform, domain and package code should consume these configurations rather than defining their own. If you need workspace-specific configuration, extend these as your base and merge your overrides.

---

## Commands

Run these from the repository root:

| Command                           | Description |
| --------------------------------- | ----------- |
| `pnpm --filter @flex/config lint` | Lint files  |

Alternatively, run `pnpm <command>` from within `libs/config/`.

## API

| Name                                                    | Description                     | Code                        |
| ------------------------------------------------------- | ------------------------------- | --------------------------- |
| [`@flex/config/eslint`](#flexconfigeslint)              | Shared ESLint configuration     | [View](./src/eslint.mjs)    |
| [`@flex/config/tsconfig.json`](#flexconfigtsconfigjson) | Shared TypeScript configuration | [View](./src/tsconfig.json) |
| [`@flex/config/vitest`](#flexconfigvitest)              | Shared Vitest configuration     | [View](./src/vitest.ts)     |

---

## `@flex/config/eslint`

Shared ESLint configuration with TypeScript, Prettier and import sorting.

Supported file types for linting:

- TypeScript (.ts)
- JavaScript (.js, .mjs)
- HTML (.html)
- JSON (.json)
- Markdown (.md)

### Usage

Create `eslint.config.mjs` in the workspace root:

```javascript
import { config } from "@flex/config/eslint";

export default config;
```

---

## `@flex/config/tsconfig.json`

Shared TypeScript configuration with strict mode and ES module settings.

### Usage

Create `tsconfig.json` in the workspace root:

```json
{
  "extends": "@flex/config/tsconfig.json",
  "include": ["src/**/*.ts"]
}
```

#### With Vitest

Include the Vitest configuration file for type checking:

```json
{
  "extends": "@flex/config/tsconfig.json",
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

---

## `@flex/config/vitest`

Shared Vitest configuration with coverage settings.

### Usage

Create `vitest.config.ts` in the workspace root:

```typescript
import { config } from "@flex/config/vitest";

export default config;
```

#### With Overrides

Merge workspace-specific configuration with the shared config:

```typescript
import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    // Add workspace-specific configuration
  }),
);
```

---

## Related

**FLEX:**

- [@flex/testing](/libs/testing/README.md)
- [Platform Development Guide](/docs/platform-development.md)

**External:**

- [ESLint Configuration](https://eslint.org/docs/latest/use/configure/)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig/)
- [Vitest Configuration](https://vitest.dev/config/)
