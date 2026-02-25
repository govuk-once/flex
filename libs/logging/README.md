# @flex/logging

Structured logging utilities for FLEX Lambda handlers built on AWS Lambda Powertools.

---

## Commands

Run these from the repository root:

| Command                            | Description    |
| ---------------------------------- | -------------- |
| `pnpm --filter @flex/logging lint` | Lint files     |
| `pnpm --filter @flex/logging test` | Run tests      |
| `pnpm --filter @flex/logging tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `libs/logging/`.

## API

| Name                                          | Description                                    | Code                       |
| --------------------------------------------- | ---------------------------------------------- | -------------------------- |
| [`createLogger`](#createlogger)               | Creates and caches a logger instance           | [View](./src/index.ts)     |
| [`getLogger`](#getlogger)                     | Returns the cached logger instance             | [View](./src/index.ts)     |
| [`getChildLogger`](#getchildlogger)           | Creates a child logger with extra context      | [View](./src/index.ts)     |
| [`injectLambdaContext`](#injectlambdacontext) | Middy middleware for Lambda context injection  | [View](./src/index.ts)     |
| [`LogSanitizer`](#logsanitizer)               | Redacts secrets and sensitive values from logs | [View](./src/sanitizer.ts) |

### Types

| Name                  | Description                              | Code                       |
| --------------------- | ---------------------------------------- | -------------------------- |
| `LoggerOptions`       | Configuration options for `createLogger` | [View](./src/index.ts)     |
| `LogSanitizerOptions` | Configuration options for `LogSanitizer` | [View](./src/sanitizer.ts) |

---

## `createLogger`

Creates a Logger instance and caches it as the singleton. Called once per Lambda cold start, typically by `createLambdaHandler` from `@flex/handlers`.

```typescript
import { createLogger } from "@flex/logging";

const logger = createLogger({
  logLevel: "INFO",
  serviceName: "service-name",
});

logger.info("Hello from service-name!");
```

---

## `getLogger`

Returns the cached logger instance created by `createLogger`. Use this in downstream modules that need the logger without knowing its configuration.

Throws if called before `createLogger`.

```typescript
import { getLogger } from "@flex/logging";

const logger = getLogger();

logger.info("Using cached logger instance");
```

---

## `getChildLogger`

Creates a child logger with additional context. Useful for adding request-specific metadata without modifying the parent logger.

Throws if called before `createLogger`.

```typescript
import { createLogger, getChildLogger } from "@flex/logging";

createLogger({ logLevel: "INFO", serviceName: "service-name" });

const childLogger = getChildLogger({ requestId: "abc-123", userId: "456" });

childLogger.info("Processing request");
// Logs include: { requestId: "abc-123", userId: "456", ... }
```

---

## `injectLambdaContext`

Re-exported Middy middleware from AWS Lambda Powertools. Automatically adds Lambda context to all log entries.

This middleware is applied automatically by `createLambdaHandler` from `@flex/handlers`.

---

## `LogSanitizer`

Redacts secrets and sensitive values from log output. Uses key name patterns and value shape patterns to detect sensitive data. Integrated into the logger via Powertools `jsonReplacerFn` — works recursively on nested objects and arrays automatically.

A default sanitizer is applied by `createLogger` with built-in patterns for common secret key names and JWT tokens. Pass a custom `sanitizer` to `createLogger` to override.

Secret values can also be added at runtime via `addSecretValue()` — any string value containing the secret will be redacted. This is useful for intercepting secrets loaded from Secrets Manager.

### Default Patterns

Keys matching (case-insensitive):

`secret`, `token`, `password`, `passwd`, `authorization`, `apikey`, `api_key`, `credential`, `private_key`, `access_key`, `client_secret`, `signing`

Values matching:

`/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/` (JWT tokens)

Redacted values are replaced with `***secret-value***`.

### Usage

#### Custom Sanitizer

```typescript
import { createLogger, LogSanitizer } from "@flex/logging";

const sanitizer = new LogSanitizer({
  keyPatterns: [/secret/i, /token/i, "pairwiseId"],
  valuePatterns: [/^eyJ/],
  parseStringifiedJson: true,
});

const logger = createLogger({
  logLevel: "INFO",
  serviceName: "my-service",
  sanitizer,
});

logger.info("User data", { pairwiseId: "abc-123", name: "Alice" });
// pairwiseId logged as "***secret-value***", name logged as "Alice"
```

#### Runtime Secret Values

```typescript
import { LogSanitizer } from "@flex/logging";

const sanitizer = new LogSanitizer();

// Add secrets as they are fetched from Secrets Manager
sanitizer.addSecretValue("my-api-key-from-sm");

// Any log value containing the secret will be redacted
logger.info("Request", { apiKey: "my-api-key-from-sm" });
// apiKey logged as "***secret-value***"
```

#### Constructor Options

| Option                 | Type                      | Default | Description                                                                 |
| ---------------------- | ------------------------- | ------- | --------------------------------------------------------------------------- |
| `keyPatterns`          | `Array<string \| RegExp>` | `[]`    | Strings matched case-insensitively as substrings; regexes tested as-is      |
| `valuePatterns`        | `Array<string \| RegExp>` | `[]`    | Same logic, applied to string values only                                   |
| `parseStringifiedJson` | `boolean`                 | `false` | If true, parses string values as JSON, sanitizes the result, and re-stringifies |

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md#with-logging)
- [Auth Handler](/platform/domains/auth/README.md)
- [Viewer Request Handler](/platform/domains/viewer-request-cff/README.md)

**External:**

- [AWS Lambda Powertools Logger](https://docs.aws.amazon.com/powertools/typescript/latest/features/logger/)
