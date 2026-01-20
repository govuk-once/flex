# @flex/eslint-config

This package provides a shared ESLint configuration for projects within this monorepo.

Its goal is to ensure consistent linting rules, code style, and best practices across all projects, while allowing individual projects to extend or override rules when necessary.

All projects in this monorepo are expected to consume these configs rather than defining their own ESLint rules.

Currently this config supports the following files:

- TypeScript **(.ts)**
- JavaScript **(.js, .mjs)**
- HTML **(.html)**
- JSON **(.json)**
- Markdown **(.md)**

---

## Usage

Each project should create its own `eslint.config.mjs` file and import this shared configuration.

```mjs
import { config } from "@flex/eslint-config";

/** @type {import("eslint").Linter.Config} */
export default config;
```

---

## Installation

Projects can reference it directly via the workspace package name.

```json
"devDependencies": {
  "@flex/eslint-config": "workspace:*",
  ...
}
```

---

## Adding new config

We currently use a single config file using the ESLint flat config format. Within this config we split the different file types we support into their own config blocks. To add support for a new file type simply add the relevant plugin and a new config block within the flat config. Make sure to define the files this plugin should operate on.
