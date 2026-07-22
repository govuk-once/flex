# @flex/telemetry

Emits analytics telemetry events as structured log lines via `@flex/logging`.
Currently emits to CloudWatch alongside normal application logs, with the
logger's standard context (service, org, team, request id, trace id, etc).

## Usage

```ts
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";

emitTelemetry(TelemetryEvent.auth_success, { userId: "123" });
```

Each event produces an `INFO` log line with the message `telemetry` and a
`telemetry` attribute namespace:

```json
{
  "level": "INFO",
  "message": "telemetry",
  "service": "...",
  "timestamp": "...",
  "telemetry": {
    "event": "auth_success",
    "details": { "userId": "123" }
  }
}
```

Details are sanitized by the logging formatter, so registered secrets and
sensitive keys are redacted as per standard logging practice.

Query events in CloudWatch Logs Insights with:

```
filter ispresent(telemetry.event)
```

## CloudFront Functions

CloudFront Functions cannot run `@flex/logging` (no Node APIs, 10KB code
limit), so the package provides a dependency-free `cff` entry point that
writes the same queryable JSON shape straight to `console.log`:

```ts
import { CffTelemetryEvent, emitCffTelemetry } from "@flex/telemetry/cff";

emitCffTelemetry(CffTelemetryEvent.cff_token_validated, { correlationId });
```

`CffTelemetryEvent` is a plain object holding the `cff_*` subset of the
registry; a compile-time check keeps it in sync with the central enum. Timestamps come from CloudWatch. Note there is no
sanitization in CloudFront Functions, so details must not contain sensitive values.

## Adding an event

Add the event name to `TelemetryEventSchema` in `src/events.ts`. For readability outside of the codebase
they're in snake_case.

## Testing

A vitest manual mock ships with the package:

```ts
vi.mock("@flex/telemetry");

expect(emitTelemetry).toHaveBeenCalledWith(TelemetryEvent.auth_success);
```

The `cff` entry point has its own mock: `vi.mock("@flex/telemetry/cff")`.
