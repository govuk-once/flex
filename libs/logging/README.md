# @flex/logging

Structured logging utilities for FLEX Lambda handlers built on AWS Lambda Powertools.

---

## Commands

Run these from the repository root:

| Command                            | Description |
| ---------------------------------- | ----------- |
| `pnpm --filter @flex/logging lint` | Lint files  |
| `pnpm --filter @flex/logging test` | Run tests   |

Alternatively, run `pnpm <command>` from within `libs/logging/`.

## API

| Name                                          | Description                                   | Code                   |
| --------------------------------------------- | --------------------------------------------- | ---------------------- |
| [`getLogger`](#getlogger)                     | Returns a cached logger instance              | [View](./src/index.ts) |
| [`getChildLogger`](#getchildlogger)           | Creates a child logger with extra context     | [View](./src/index.ts) |
| [`injectLambdaContext`](#injectlambdacontext) | Middy middleware for Lambda context injection | [View](./src/index.ts) |

### Types

| Name            | Description                           | Code                   |
| --------------- | ------------------------------------- | ---------------------- |
| `LoggerOptions` | Configuration options for `getLogger` | [View](./src/index.ts) |

---

## `getLogger`

Returns a cached singleton logger instance. Creates the logger on first call with options, then returns the cached instance on subsequent calls.

Throws if called without required options before the logger has been initialised.

### Usage

```typescript
import { getLogger } from "@flex/logging";

const logger = getLogger({
  logLevel: "INFO",
  serviceName: "service-name",
});

logger.info("Hello from service-name!");
logger.debug("Debug message", { userId: "123" });
```

#### Without Options

After initialisation, retrieve the cached logger without passing options:

```typescript
import { getLogger } from "@flex/logging";

const logger = getLogger();

logger.info("Using cached logger instance");
```

---

## `getChildLogger`

Creates a child logger with additional context. Useful for adding request-specific metadata without modifying the parent logger.

Throws if called before the logger has been initialised with `getLogger()`.

### Usage

```typescript
import { getChildLogger, getLogger } from "@flex/logging";

getLogger({ logLevel: "INFO", serviceName: "service-name" });

const childLogger = getChildLogger({ requestId: "abc-123", userId: "456" });

childLogger.info("Processing request");
// Logs include: { requestId: "abc-123", userId: "456", ... }
```

---

## `injectLambdaContext`

Re-exported Middy middleware from AWS Lambda Powertools. Automatically adds Lambda context to all log entries.

This middleware is applied automatically by `createLambdaHandler` from `@flex/handlers`.

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md#with-logging)
- [Auth Handler](/platform/domains/auth/README.md)
- [Fail Fast Handler](/platform/domains/fail-fast/README.md)

**External:**

- [AWS Lambda Powertools Logger](https://docs.aws.amazon.com/powertools/typescript/latest/features/logger/)
