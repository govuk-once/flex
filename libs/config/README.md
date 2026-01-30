# @flex/config

Shared configuration for ESLint, TypeScript and Vitest across FLEX.

This package ensures consistent linting rules, code style and type checking across all workspaces. All platform, domain and package code should consume these configurations rather than defining their own. If you need workspace-specific configuration, extend these as your base and merge your overrides.

---

## Commands

Run these from the repository root:

| Command                           | Description    |
| --------------------------------- | -------------- |
| `pnpm --filter @flex/config lint` | Lint files     |
| `pnpm --filter @flex/config tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `libs/config/`.

## API

| Name                                                    | Description                               | Code                        |
| ------------------------------------------------------- | ----------------------------------------- | --------------------------- |
| [`@flex/config/eslint`](#flexconfigeslint)              | Shared ESLint configuration               | [View](./src/eslint.mjs)    |
| [`@flex/config/tsconfig.json`](#flexconfigtsconfigjson) | Shared TypeScript configuration           | [View](./src/tsconfig.json) |
| [`@flex/config/vitest`](#flexconfigvitest)              | Shared Vitest configuration               | [View](./src/vitest.ts)     |
| [`@flex/config/domain`](#flexDomain)                    | Shared Domain interface for configuration | [View](./src/domain.ts)     |

---

## `@flex/config/domain`

### `defineDomain`

This function allows you to define you domain config such as endpoints. You need to add the following at the root of your domain config for the IaC to pick up you domain settings to deploy `domain.config.ts`.

#### Usage

```typescript
import { defineDomain } from "@flex/iac";

export const endpoints = defineDomain({
  domain: "example",
  versions: {
    v1: {
      routes: {
        "/example": {
          GET: {
            entry: "handlers/v1/example/get.ts",
            type: "ISOLATED",
            envSecret: {
              FLEX_EXAMPLE_SECRET: "/flex-secret/example/example-hash-secret",
            },
          },
          PATCH: {
            type: "ISOLATED",
            entry: "handlers/v1/example/patch.ts",
            kmsKeys: {
              ENCRYPTION_KEY_ARN: "/flex-secret/encryption-key",
            },
          },
        },
      },
    },
    v2: {
      routes: {
        "/example": {
          GET: {
            entry: "handlers/v2/example/get.ts",
            type: "ISOLATED",
            envSecret: {
              FLEX_EXAMPLE_SECRET: "/flex-secret/example/example-hash-secret",
            },
          },
        },
      },
    },
  },
});
```

The above example would make 3 endpoints for the domain `example` which are:

- GET ~ `/app/v1/example`
- PATCH ~ `/app/v1/example`
- GET ~ `/app/v2/example`

Reference:

```text
{
  // Service Identity
  domain: "example",            // (Required) Unique identifier for the service/domain.
  owner: "example@example.com", // (Optional) Owner of this domain.

  // API Versions (Map: VersionID -> Config)
  versions: {
    "v1": {
      // Routes (Map: Path -> Methods)
      // Paths must start with '/'
      routes: {
        "/example": {

          // HTTP Methods (Map: Method -> Handler Config)
          // Allowed: GET, POST, PUT, DELETE, PATCH, HEAD
          GET: {
            // Handler Logic
            entry: "handlers/v1/example/get.ts", // Path relative to domain root

            // Network Access Level
            // Options: "PUBLIC" | "PRIVATE" | "ISOLATED"
            type: "ISOLATED",

            // Secrets (Injected as Environment Variables)
            // Key = Process.env name | Value = SSM/SecretManager path
            envSecret: {
              FLEX_EXAMPLE_SECRET: "/flex-secret/example/secret-path",
            },

            // Parameters (SSM Parameter Store)
            // Value is the PATH in AWS SSM.
            // Result is injected as process.env.TABLE_NAME
            env: {
              TABLE_NAME: "/flex/config/dynamodb-table-name"
            },

            // KMS Keys (Permission + ARN Injection)
            kmsKeys: {
               ENCRYPTION_KEY: "/flex-key/storage-key"
            }
          },
        },
      },
    },
  },
};
```

#### 1. Top Level Configuration

| Field    | Type                 | Required | Description                                                                        |
| -------- | -------------------- | -------- | ---------------------------------------------------------------------------------- |
| domain   | string               | Y        | The unique name of the service (e.g., "udp", "billing"). Used for resource naming. |
| owner    | string               | N        | The team or individual owning this service.                                        |
| versions | Map<string, Version> | Y        | HashMap of API versions (e.g., "v1", "v2").                                        |

#### 2. Version Configuration

| Field  | Type                    | Required | Description                                                                                                                               |
| ------ | ----------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| routes | Map<string, PathObject> | Y        | A HashMap defining all URL resources for this version. Keys must be valid URL paths starting with / (e.g., "/user", "/billing/invoices"). |

#### 3. Path Configuration

| Field                               | Type        | Required                 | Description                                                                      |
| ----------------------------------- | ----------- | ------------------------ | -------------------------------------------------------------------------------- |
| GET, POST, PUT, PATCH, DELETE, HEAD | RouteObject | At least one is required | The HTTP method configuration. Defines the handler logic for that specific verb. |

#### 4. Route Configuration

| Field     | Type                   | Description                                                       |
| --------- | ---------------------- | ----------------------------------------------------------------- |
| entry     | string                 | Path to the TypeScript handler file relative to the project root. |
| type      | enum                   | Defines network access (PUBLIC, PRIVATE, ISOLATED).               |
| env       | Record<string, string> | Maps process.env[KEY] to an SSM Parameter Store path.             |
| envSecret | Record<string, string> | Maps process.env[KEY] to a Secrets Manager path.                  |
| kmsKeys   | Record<string, string> | Maps process.env[KEY] to a KMS Key Alias.                         |

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
