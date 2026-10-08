---
title: "@flex/config"
description: The shared ESLint, TypeScript and Vitest configuration that every workspace package extends.
---

`@flex/config` lives in `libs/config` and holds the shared ESLint, TypeScript and Vitest
configuration. Every workspace package extends it instead of writing its own. When a package
needs something different, it merges an override on top of the shared configuration.

## Exports

| Import | Source | Exports |
| --- | --- | --- |
| `@flex/config/eslint` | [`src/eslint.mjs`](https://github.com/govuk-once/flex/blob/main/libs/config/src/eslint.mjs) | `config`, a flat ESLint configuration array |
| `@flex/config/tsconfig.json` | [`src/tsconfig.json`](https://github.com/govuk-once/flex/blob/main/libs/config/src/tsconfig.json) | Compiler options to `extends` |
| `@flex/config/vitest` | [`src/vitest.ts`](https://github.com/govuk-once/flex/blob/main/libs/config/src/vitest.ts) | `config`, the Vitest configuration for unit tests |
| `@flex/config/vitest/e2e` | [`src/vitest.e2e.ts`](https://github.com/govuk-once/flex/blob/main/libs/config/src/vitest.e2e.ts) | `e2eConfig`, the Vitest configuration for a domain's E2E suite |

A package adds `@flex/config` as a `workspace:*` dev dependency and has one file for each tool:

```text
<package>/
  eslint.config.mjs      @flex/config/eslint
  tsconfig.json          @flex/config/tsconfig.json
  vitest.config.ts       @flex/config/vitest
  vitest.e2e.config.ts   @flex/config/vitest/e2e (domains with E2E tests only)
```

The package's own only script is `lint`. Run it with `pnpm --filter @flex/config lint`.

## ESLint

`eslint.config.mjs` in a package, and at the repository root, re-exports the shared array:

```javascript
import { config } from "@flex/config/eslint";

export default config;
```

Every package lints with `eslint --max-warnings=0 .`, so a warning fails the lint as an error
does. The configuration ignores everything the repository's `.gitignore` files ignore, and applies
these rules by file type:

| Files | Rules |
| --- | --- |
| `**/*.js`, `**/*.mjs` | ESLint recommended, and sorted imports and exports with `simple-import-sort`. |
| `**/*.ts`, `**/*.tsx` | ESLint recommended and typescript-eslint `strictTypeChecked`, with type information from the project service. `no-floating-promises` is an error. `prefer-readonly` and a selection of `sonarjs` and `unicorn` rules are warnings. Imports and exports are sorted. |
| `**/*.tsx` | `@eslint-react` recommended rules for TypeScript. |
| `**/*.tsx`, `libs/cli/*.ts` | `react-hooks` recommended rules. |
| `**/*.html` | `@html-eslint`. |
| `**/*.json` | `@eslint/json`. Duplicate keys are errors. |
| `**/*.md` | `@eslint/markdown` with CommonMark. Raw HTML is an error. |
| `tests/**`, `**/*.test.ts` | `@vitest/eslint-plugin` recommended rules. A focused test (`.only`) is an error. Imports from `@flex/testing` and `@flex/e2e` count as Vitest imports. |
| All files | Prettier, through `eslint-plugin-prettier`. The repository has no Prettier configuration, so Prettier's defaults apply. |

An unused variable, argument or caught error is a warning unless its name starts with `_`.

Type-aware rules need every linted `.ts` file to belong to a TypeScript project. A file that no
`tsconfig.json` includes, such as a `vitest.config.ts` left out of `include`, fails to lint.

## TypeScript

`tsconfig.json` in a package extends the shared options and lists what to include:

```json
{
  "extends": "@flex/config/tsconfig.json",
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

Include every TypeScript file in the package, configuration files too, so that `tsc` checks them
and ESLint can lint them. A domain with E2E tests also includes `e2e/**/*.ts` and
`vitest.e2e.config.ts`. A package can add `compilerOptions.paths` for its own import aliases. The
example domain maps `@domain` to `./domain.config.ts`, for instance, and Vitest resolves the
aliases too (see [Vitest](#vitest)).

The shared options:

| Option | Value | Effect |
| --- | --- | --- |
| `strict` | `true` | All strict checks. |
| `noUncheckedIndexedAccess` | `true` | Indexed access may be `undefined`, so `array[0]` must be checked before use. |
| `target`, `lib` | `ES2022`; `DOM`, `DOM.Iterable`, `es2022` | Language level and built-in types, including `fetch`, `Request` and `Response`. |
| `module`, `moduleResolution` | `esnext`, `bundler` | ES modules resolved the way esbuild and Vitest resolve them. Imports need no file extension. |
| `moduleDetection` | `force` | Every file is a module. |
| `isolatedModules` | `true` | Each file must compile on its own, as esbuild compiles it. |
| `allowJs`, `checkJs` | `true` | JavaScript files are type-checked too. |
| `resolveJsonModule` | `true` | JSON files can be imported. |
| `jsx` | `react-jsx` | For the `.tsx` files in `@flex/cli`. |
| `skipLibCheck` | `true` | Declaration files in dependencies are not checked. |
| `rootDir` | `${configDir}` | The directory of the package's own `tsconfig.json`. |

Packages run `tsc --noEmit` as their `tsc` script, so `outDir` and the declaration settings have no
effect there. Lambda code is bundled by esbuild during deployment, not compiled by `tsc`.

## Vitest

`config` from `@flex/config/vitest` sets:

| Setting | Value |
| --- | --- |
| `test.environment` | `node` |
| `resolve.tsconfigPaths` | `true`, so the `paths` aliases in the package's `tsconfig.json` resolve in tests |
| `test.coverage` | The `v8` provider, `text` and `lcov` reports written to `./coverage`, covering `src/**/*.ts` but not test files, `__mocks__` or `__tests__` |

Coverage only runs when Vitest is given `--coverage`, as the `test:coverage` scripts do.

A package with nothing to add re-exports `config` as its default:

```typescript
export { config as default } from "@flex/config/vitest";
```

Most packages merge settings on top of it:

```typescript
import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        AWS_REGION: "eu-west-2",
      },
    },
  }),
);
```

- `exclude` keeps a domain's E2E tests out of its unit test run. Vitest's default `include` would
  otherwise pick up `e2e/*.test.ts`.
- `setupFiles` loads one of the setup files from `@flex/testing`: `setup/sdk` for domains and
  `setup/platform` for service gateways and platform handlers. See
  [Setup files](/flex/reference/flex-testing/#setup-files).
- `env` sets the environment variables the code under test reads when it loads.

What a domain puts in `env` is covered in [Testing domains](/flex/domains/testing/), and what a
gateway needs in [Testing gateways](/flex/gateways/testing/).

### E2E configuration

`e2eConfig` from `@flex/config/vitest/e2e` is `config` with two additions:

| Setting | Value |
| --- | --- |
| `test.globalSetup` | `["@flex/testing/e2e/setup"]`, which resolves the deployed stage before the run (see [Global setup](/flex/reference/flex-testing/#global-setup)) |
| `test.include` | `["e2e/**/*.test.ts"]` |

A domain's `vitest.e2e.config.ts` merges its own settings over it, usually a longer timeout:

```typescript
import { e2eConfig } from "@flex/config/vitest/e2e";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  e2eConfig,
  defineConfig({
    test: {
      testTimeout: 40_000,
    },
  }),
);
```

The domain's `test:e2e` script runs it with `vitest --passWithNoTests --config vitest.e2e.config.ts`.
The platform suite in `tests/e2e` does not use `e2eConfig`. It merges `globalSetup` into `config`
itself. See [E2E tests](/flex/delivery/e2e-tests/).
