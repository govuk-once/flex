# Log Redaction and Filtering

How FLEX prevents sensitive information from reaching log aggregators, following [GDS standards for logging](https://gds-way.digital.cabinet-office.gov.uk/standards/logging.html#filtering-out-sensitive-information).

---

## Overview

FLEX uses three layers of protection to ensure sensitive data is never persisted in logs:

| Layer            | Mechanism                        | What it prevents                                           |
| ---------------- | -------------------------------- | ---------------------------------------------------------- |
| **Sanitiser**    | Key and value pattern matching   | PII and secrets in log attributes at any log level         |
| **Log clamping** | `FLEX_LOG_LEVEL_CEILING` env var | DEBUG/TRACE logs with detailed data from firing in production |
| **PII toggle**   | `FLEX_LOG_PII_DEBUG` env var     | Relaxed redaction physically impossible in production      |

---

## Sanitiser

The sanitiser ([`libs/logging/src/sanitizer.ts`](/libs/logging/src/sanitizer.ts)) runs on every log entry via the `FlexLogFormatter`. It processes all attributes recursively, including nested objects and arrays.

### Secret patterns (always redacted)

These are never bypassed, regardless of environment or toggle settings.

**By key:** `secret`, `token`, `password`, `passwd`, `authorization`, `apikey`, `api_key`, `credential`, `private_key`, `access_key`, `client_secret`, `signing`

**By value:** JWT tokens (strings starting with `eyJ...`)

**By runtime registration:** Values registered with `addSecretValue()` are replaced inline wherever they appear in log strings.

### PII patterns (redacted by default)

These protect personally identifiable information and comply with data protection regulations.

**By key:** `email`, `phone`, `mobile`, `forename`, `surname`, `first_name`, `last_name`, `full_name`, `date_of_birth`, `dob`, `nino`, `national_insurance`, `postcode`, `zip_code`, `sort_code`, `account_number`, `ip_address`

**By value:**

| Pattern               | Example             |
| --------------------- | ------------------- |
| Email addresses       | `user@example.com`  |
| UK phone numbers      | `+447700900000`     |
| National Insurance    | `AB123456C`         |
| UK postcodes          | `SW1A 1AA`          |
| IPv4 addresses        | `192.168.1.1`       |

All redacted values are replaced with `***REDACTED***`.

### Adding new patterns

To add a new redaction pattern, edit [`libs/logging/src/sanitizer.ts`](/libs/logging/src/sanitizer.ts):

1. Add key patterns to `secretKeyPatterns` (for secrets) or `piiKeyPatterns` (for PII)
2. Add value patterns to `secretValuePatterns` (for secrets) or `piiValuePatterns` (for PII)
3. Add corresponding tests in [`libs/logging/src/sanitizer.test.ts`](/libs/logging/src/sanitizer.test.ts)

The distinction matters: secret patterns are **never** bypassed, while PII patterns can be bypassed with the debug toggle in non-production environments.

---

## Log level clamping

The log level clamping mechanism ([`libs/logging/src/logLevel.ts`](/libs/logging/src/logLevel.ts)) restricts the effective log level between a floor and ceiling.

In production, CDK sets `FLEX_LOG_LEVEL_CEILING=INFO` on all Lambda functions. This means:

- `logger.debug(...)` and `logger.trace(...)` calls never execute
- The `logEvent: true` option in `injectLambdaContext` (which logs full Lambda events at DEBUG level) never fires
- Detailed request/response data that may contain PII is never logged

This is a **preventive** control — sensitive data is never logged in the first place, which is the GDS recommended approach of filtering sensitive information before it reaches log storage.

### How CDK enforces this

Each Lambda construct (`FlexPublicFunction`, `FlexPrivateEgressFunction`, `FlexPrivateIsolatedFunction`) injects `FLEX_ENVIRONMENT` and conditionally sets `FLEX_LOG_LEVEL_CEILING`:

```typescript
environment: {
  FLEX_ENVIRONMENT: stage,
  ...(stage === "production" && { FLEX_LOG_LEVEL_CEILING: "INFO" }),
  ...functionProps.environment,
}
```

Domain-provided environment variables are spread **after** platform variables, but the clamping logic in the logger prevents any override from exceeding the ceiling.

---

## PII debug toggle

For debugging in non-production environments, PII redaction can be temporarily bypassed.

### How to enable

Set `FLEX_LOG_PII_DEBUG=true` as a Lambda environment variable. This can be done via the domain config or directly in the AWS console for a specific function.

### What it does

When enabled, **PII key and value patterns are bypassed** — data like emails, phone numbers, and postcodes will appear in logs. **Secret patterns are never bypassed** — passwords, tokens, and JWTs remain redacted.

### Production safeguards

The toggle is protected by two independent mechanisms:

1. **CDK (deploy-time):** The `FLEX_LOG_PII_DEBUG` variable is not injected for production Lambda functions. It physically does not exist in the environment.
2. **Runtime guard:** Even if `FLEX_LOG_PII_DEBUG=true` were somehow set, the sanitiser checks `FLEX_ENVIRONMENT` and blocks the toggle when it equals `production`.

---

## Environment variables

| Variable                 | Set by   | Description                                           |
| ------------------------ | -------- | ----------------------------------------------------- |
| `FLEX_ENVIRONMENT`       | CDK      | Deployment environment (e.g. `production`, `staging`) |
| `FLEX_LOG_LEVEL_CEILING` | CDK      | Maximum log verbosity (`INFO` in production)          |
| `FLEX_LOG_PII_DEBUG`     | Optional | Bypass PII redaction (non-production only)            |
| `FLEX_LOG_LEVEL_FLOOR`   | CDK      | Minimum log verbosity (default: `INFO`)               |

---

## Related

**FLEX:**

- [@flex/logging](/libs/logging/README.md)
- [@flex/handlers](/libs/handlers/README.md)
- [Domain Development Guide](/docs/domain-development.md)

**External:**

- [GDS Logging Standards — Filtering out sensitive information](https://gds-way.digital.cabinet-office.gov.uk/standards/logging.html#filtering-out-sensitive-information)
- [AWS Lambda Powertools Logger](https://docs.aws.amazon.com/powertools/typescript/latest/features/logger/)
