# @flex/typescript-config

This package provides shared TypeScript `tsconfig` base configurations for projects within this monorepo.

Its purpose is to standardize TypeScript compiler options across projects while still allowing individual projects to customize settings when necessary.

All projects in this monorepo are expected to extend this config rather than defining their own `tsconfig` setting.

---

## Usage

Each project should create its own `tsconfig.json` file and extend this base configuration.

```json
{
  "extends": "@flex/typescript-config/base.json",
  "include": ["src/**/*.ts", "eslint.config.mjs", "vitest.config.ts"]
}
```

Make sure to include your source directory as well as any config files that are required.

---

## Installation

Projects can reference it directly via the workspace package name.

```json
"devDependencies": {
  "@flex/typescript-config": "workspace:*",
  ...
}
```

---

## Adding new config

Config files are available at the root of this package and can be referenced directly. For example adding a `new.json` config would be available as the following:

```json
{
  "extends": "@flex/typescript-config/new.json"
}
```

If a new config file is required we recommend extending the `base.json` config and adding specific overrides for that new config. This will help maintain the base settings across the monorepo.
