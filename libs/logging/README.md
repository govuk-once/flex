# @flex/logging

Structured logging utilities for FLEX Lambda handlers built on AWS Lambda Powertools.

Provides a platform-controlled logger with automatic sanitization of sensitive data, organisational context, and log level guard rails.

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

| Name                                          | Description                                                | Code                       |
| --------------------------------------------- | ---------------------------------------------------------- | -------------------------- |
| [`logger`](#logger)                           | Platform-configured logger instance                        | [View](./src/index.ts)     |
| [`setLogServiceName`](#setlogservicename)     | Sets the service name on the logger (handler factory only) | [View](./src/index.ts)     |
| [`setLogLevel`](#setloglevel)                 | Sets the log level on the logger (handler factory only)    | [View](./src/index.ts)     |
| [`createChildLogger`](#createchildlogger)     | Creates a child logger with extra context                  | [View](./src/index.ts)     |
| [`addSecretValue`](#addsecretvalue)           | Registers a runtime secret for log redaction               | [View](./src/sanitizer.ts) |
| [`injectLambdaContext`](#injectlambdacontext) | Middy middleware for Lambda context injection              | [View](./src/index.ts)     |

### Types

| Name     | Description                       | Code                   |
| -------- | --------------------------------- | ---------------------- |
| `Logger` | AWS Lambda Powertools Logger type | [View](./src/index.ts) |

---

## `logger`

A ready-to-use logger instance, exported directly. Domain developers import it and use it — no initialisation needed.

The logger is created at module load time with log level resolved from environment variables and clamped between platform-defined floor and ceiling.

### Usage

```typescript
import { logger } from "@flex/logging";

logger.info("Hello from my service!");
logger.debug("Debug details", { userId: "123" });
```

### Log level resolution

The effective log level is resolved in this order:

1. `POWERTOOLS_LOG_LEVEL` environment variable
2. `LOG_LEVEL` environment variable
3. Falls back to `INFO`

The resolved level is then clamped between:

- **Ceiling** (`FLEX_LOG_LEVEL_CEILING`) — most verbose allowed (default: `TRACE`)
- **Floor** (`FLEX_LOG_LEVEL_FLOOR`) — least verbose allowed (default: `INFO`)

This prevents domain code from suppressing errors (`SILENT`) or flooding production with trace logs.

---

## `setLogServiceName`

Sets the service name on the log formatter. Called by `createLambdaHandler` from `@flex/handlers` — domain developers should not call this directly.

```typescript
setLogServiceName("my-service");
```

---

## `setLogLevel`

Sets the log level on the logger instance. The level is clamped between floor and ceiling. Called by `createLambdaHandler` from `@flex/handlers` — domain developers should not call this directly.

```typescript
setLogLevel("DEBUG");
```

---

## `createChildLogger`

Creates a child logger with additional persistent context. Use this to add request-specific metadata without modifying the platform logger.

### Usage

```typescript
import { createChildLogger } from "@flex/logging";

const childLogger = createChildLogger({ requestId: "abc-123", userId: "456" });

childLogger.info("Processing request");
// Logs include: { requestId: "abc-123", userId: "456", ... }
```

---

## `addSecretValue`

Registers a runtime secret value for redaction in log output. Any occurrence of the registered value in log strings will be replaced with `***REDACTED***`.

### Usage

```typescript
import { addSecretValue } from "@flex/logging";

addSecretValue(databasePassword);
addSecretValue(apiKey);
```

---

## `injectLambdaContext`

Re-exported Middy middleware from AWS Lambda Powertools. Automatically adds Lambda context to all log entries.

This middleware is applied automatically by `createLambdaHandler` from `@flex/handlers`.

---

## Sanitization

All logs pass through the `FlexLogFormatter` which sanitizes sensitive data:

- **Key patterns** — keys matching `password`, `secret`, `token`, `apikey`, `authorization`, `credential`, `private_key`, `access_key`, `client_secret`, `signing` are fully redacted
- **Value patterns** — JWT tokens (values starting with `eyJ...`) are fully redacted
- **Runtime secrets** — values registered via `addSecretValue` are replaced inline
- **Nested objects** — sanitization recurses into nested object structures
- **Arrays** — sanitization recurses into arrays, including nested objects within arrays

---

## Testing

A shared mock is provided at `libs/logging/src/__mocks__/index.ts`. In test files, mock the entire module without a factory:

```typescript
vi.mock("@flex/logging");
```

This provides `logger` with all methods as `vi.fn()` spies, plus stubs for `setLogServiceName`, `setLogLevel`, `createChildLogger`, `addSecretValue`, and `injectLambdaContext`.

---

## Environment variables

| Variable                 | Description                           | Default |
| ------------------------ | ------------------------------------- | ------- |
| `POWERTOOLS_LOG_LEVEL`   | Primary log level override            | —       |
| `LOG_LEVEL`              | Fallback log level override           | —       |
| `FLEX_LOG_LEVEL_FLOOR`   | Least verbose allowed level           | `INFO`  |
| `FLEX_LOG_LEVEL_CEILING` | Most verbose allowed level            | `TRACE` |
| `FLEX_ORG`               | Organisation name added to log output | —       |
| `FLEX_TEAM`              | Team name added to log output         | —       |

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md#with-logging)
- [Auth Handler](/platform/domains/auth/README.md)
- [Viewer Request Handler](/platform/domains/viewer-request-cff/README.md)

**External:**

- [AWS Lambda Powertools Logger](https://docs.aws.amazon.com/powertools/typescript/latest/features/logger/)
