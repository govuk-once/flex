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

`CffTelemetryEvent` is the single registry of CloudFront Function events. It
is a plain object kept separate from `TelemetryEventSchema` because the zod
enum cannot be bundled into a CloudFront Function. Timestamps come from
CloudWatch. Note there is no sanitization in CloudFront Functions, so details
must not contain sensitive values.

## Adding an event

Add the event name to `TelemetryEventSchema` in `src/events.ts`. For readability outside of the codebase
they're in snake_case.

Special case: events emitted from CloudFront Functions go in the
`CffTelemetryEvent` object in `src/cff.ts` instead, not in
`TelemetryEventSchema`. The two registries are deliberately separate (see the
CloudFront Functions section above), so a `cff_*` event should exist in
exactly one place. Use the `cff_` prefix so the origin stays obvious in the
data.

## Testing

A vitest manual mock ships with the package:

```ts
vi.mock("@flex/telemetry");

expect(emitTelemetry).toHaveBeenCalledWith(TelemetryEvent.auth_success);
```

The `cff` entry point has its own mock: `vi.mock("@flex/telemetry/cff")`.
