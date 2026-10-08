---
title: Logging
description: The @flex/logging logger, its log format and levels, and how it redacts secrets and personal data before anything is written.
---

`@flex/logging` (in `libs/logging`) is the one logger every Flex Lambda function uses. It is an
[AWS Lambda Powertools logger](https://docs.aws.amazon.com/powertools/typescript/latest/features/logger/)
with a Flex log format and a sanitiser that redacts secrets and personal data from every line it
writes. Logs go to the function's CloudWatch log group.

Redaction follows the GDS standard of
[filtering out sensitive information](https://gds-way.digital.cabinet-office.gov.uk/standards/logging.html#filtering-out-sensitive-information)
before it reaches log storage.

## Using the logger

Domain handlers and gateway handlers get the logger on their context as `logger`; see
[Handlers](/flex/domains/handlers/). Other code imports it:

```typescript
import { logger } from "@flex/logging";

logger.info("Vehicle lookup complete", { vehicleCount: 3 });
logger.warn("Upstream slow", { durationMs: 2400 });
logger.error("Lookup failed", { error });
```

Pass data as the second argument, never interpolated into the message. The sanitiser can only
redact by key what it sees as a key.

`createChildLogger` returns a child logger with extra keys on every line it writes:

```typescript
import { createChildLogger } from "@flex/logging";

const log = createChildLogger({ operation: "rotate-secret" });
log.info("Starting");
// { ..., "message": "Starting", "operation": "rotate-secret" }
```

### Exports

| Export | Description |
| --- | --- |
| `logger` | The shared logger instance. It exists from module load; nothing needs initialising. |
| `createChildLogger(context?)` | A child logger with `context` added to every line. |
| `addSecretValue(value)` | Registers a value to redact wherever it appears. See [Redaction](#redaction). |
| `addSensitiveKey(pattern)` | Adds a key pattern to the personal data rules. |
| `addSensitivePattern(pattern)` | Adds a value pattern to the personal data rules. |
| `injectLambdaContext` | Powertools' Middy middleware, re-exported. The domain SDK, gateway library and authorizer already apply it. |
| `Logger`, `LogLevel` | Types. |

`logger.setServiceName(name)` and `logger.setLogLevel(level)` are for the handler factories. Domain
code does not call them.

## Log format

Every line is one JSON object:

| Field | Value |
| --- | --- |
| `level` | `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR` or `CRITICAL` |
| `message` | The message |
| `timestamp` | When the line was written |
| `service` | The service name. Domain routes use `<domain>-<gateway>-<version>-<route name>`, gateways `<name>-service-gateway`, the authorizer `auth-authorizer`. |
| `org`, `team` | The `FLEX_ORG` and `FLEX_TEAM` environment variables, when set. The platform sets neither. |
| `function_name`, `request_id` | The Lambda function name and request ID, once `injectLambdaContext` has run |
| `xray_trace_id` | The X-Ray trace ID |
| `correlation_id` | The request's `x-correlation-id` header |
| `sampling_rate` | Powertools' debug sampling rate, when set |

Any other keys passed to the logger follow these.

The correlation ID is set by the CloudFront Function on every request (see
[CloudFront Functions](/flex/edge/cloudfront-functions/)). `injectLambdaContext` reads it from the
`x-correlation-id` header, and the domain SDK forwards it on integration calls, so one ID ties a
request's lines together across domains and gateways.

## Log levels

The logger starts at `INFO`. The handler factory then sets the level:

- A domain route uses its `logLevel`, then the domain's `common.logLevel`, then `INFO`. See
  [Configuration](/flex/domains/configuration/).
- Gateways and the authorizer use `INFO`.

In production, `setLogLevel` does nothing, so every function logs at `INFO`. Production is
recognised by `FLEX_ENVIRONMENT=production`, which the
[Lambda constructs](/flex/infrastructure/lambda-constructs/) set and a domain cannot override.
`DEBUG` and `TRACE` lines are never written there.

The `POWERTOOLS_LOG_LEVEL` and `LOG_LEVEL` environment variables have no effect: the logger is
created with an explicit level, which takes precedence over them.

:::caution[Invocation events]
When a route's configured `logLevel` is `DEBUG` or `TRACE`, the domain SDK turns on
`injectLambdaContext`'s `logEvent`, which writes the whole API Gateway event at `INFO` as
`Lambda invocation event`. This follows the configured level, not the effective one, so it also
happens in production. The sanitiser still applies, but the event holds every header, query
parameter and body. Do not set `DEBUG` or `TRACE` on a route that deploys to production.
:::

## Redaction

The sanitiser in
[`libs/logging/src/sanitizer.ts`](https://github.com/govuk-once/flex/blob/main/libs/logging/src/sanitizer.ts)
is the logger's JSON replacer. It sees every key and value of every line as the line is serialised,
at any depth, inside nested objects and arrays, at every log level. There are two classes of rule.

- **Secrets** are always redacted, in every environment.
- **Personal data** is redacted by default, and can be let through outside production with the
  [debug toggle](#personal-data-debug-toggle).

A redacted value becomes `***REDACTED***`.

### Secrets

| Rule | Matches |
| --- | --- |
| Key contains | `secret`, `token`, `password`, `passwd`, `authorization`, `apikey`, `api_key`, `credential`, `private key`, `access key`, `client secret`, `signing`, `card number`, `card security code`, `card verification`, `card expir` |
| Key is the word | `pan`, `cvv`, `cvv2`, `cvc`, `cvc2`, `csc` |
| Value starts with | `eyJ` followed by two base64url segments (a JWT) |
| Value contains | A payment card number: 13 to 19 digits, optionally separated by spaces or hyphens, with a known card prefix, that passes the Luhn check |
| Value contains | A value registered with `addSecretValue` |

Key matching ignores case. In multi-word keys the separator is optional and can be any one
character, so `private_key`, `privateKey` and `private-key` all match.

Register a secret as soon as code loads it, so it cannot reach a log line afterwards:

```typescript
import { addSecretValue } from "@flex/logging";

const apiKey = await loadApiKey();
addSecretValue(apiKey);
```

`addSecretValue` ignores anything that is not a non-empty string.

### Personal data

| Rule | Matches |
| --- | --- |
| Key is the word or words | `email`, `phone`, `mobile`, `forename`, `surname`, `first name`, `last name`, `full name`, `date of birth`, `dob`, `nino`, `national insurance`, `postcode`, `zip code`, `sort code`, `account number`, `ip address` |
| Value contains | An email address |
| Value contains | A UK phone number: `+44` or `0` followed by 9 or 10 digits |
| Value contains | A National Insurance number, such as `AB123456C` |
| Value contains | A UK postcode, such as `SW1A 1AA` |
| Value contains | An IPv4 address |

Personal data keys must match as whole words, with an optional separator in multi-word keys:
`email`, `first_name` and `firstName` match; `userEmail`, `user_email` and `emailVerified` do not.

The value patterns are not anchored, so they also match inside longer strings. A numeric ID that
contains `0` followed by nine digits looks like a phone number, and a four-part version string looks
like an IPv4 address. Both are redacted.

### What gets replaced

- A key match replaces the whole value, whatever its type. An object under a key called `token` is
  replaced entirely.
- A value pattern match replaces the whole string. That includes the `message`: a message that
  contains an email address is written as `***REDACTED***`.
- A registered secret is replaced where it appears, leaving the rest of the string. Matching ignores
  case, and the longest registered value wins where two overlap.

### Adding a rule

For a rule every domain needs, add it to `sanitizer.ts`: key patterns to `secretKeyPatterns` or
`piiKeyPatterns`, value patterns to `secretValuePatterns` or `piiValuePatterns`. Add tests to
`sanitizer.test.ts`. Put it in the secrets lists only if it must never appear in any environment.

A domain can add its own rules when its module loads:

```typescript
import { addSensitiveKey, addSensitivePattern } from "@flex/logging";

addSensitiveKey(/passport/i); // redact values under keys containing "passport"
addSensitivePattern(/\b[A-Z]{2}\d{7}\b/); // redact values containing this pattern
```

Both take a `RegExp` and add to the personal data rules, so the debug toggle bypasses them outside
production. They apply to every line the function writes from then on.

### Personal data debug toggle

Setting `FLEX_LOG_PII_DEBUG=true` on a function turns off the personal data rules, including those
added with `addSensitiveKey` and `addSensitivePattern`. Secret rules still apply. Set it in the
route's `function.environment` (see [Configuration](/flex/domains/configuration/)) or on the
function in the AWS console, and remove it when you have finished.

The sanitiser ignores the toggle whenever `FLEX_ENVIRONMENT` is `production`. Because the
Lambda constructs set `FLEX_ENVIRONMENT` after a domain's own variables, a domain cannot change
that.

## Testing

The package ships a Vitest manual mock in `libs/logging/src/__mocks__/index.ts`. Mock the module
without a factory:

```typescript
vi.mock("@flex/logging");
```

`logger` then has every method as a `vi.fn()` spy, including `createChild`, `appendKeys`,
`setLogLevel` and `setServiceName`. `createChildLogger`, `addSecretValue` and
`injectLambdaContext` are spies too. The mock does not include `addSensitiveKey` or
`addSensitivePattern`; if the code under test calls them, mock the module with a factory instead.
