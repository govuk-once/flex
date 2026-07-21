# @flex/telemetry

Emits analytics telemetry events as structured log lines via `@flex/logging`.
Currently emits to CloudWatch alongside normal application logs, with the
logger's standard context (service, org, team, request id, trace id, etc).

## Usage

```ts
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";

emitTelemetry(TelemetryEvent.example_event, { userId: "123" });
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
    "event": "example_event",
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

## Adding an event

Add the event name to `TelemetryEventSchema` in `src/events.ts`. For readability outside of the codebase
they're in snake_case.

## Testing

A vitest manual mock ships with the package:

```ts
vi.mock("@flex/telemetry");

expect(emitTelemetry).toHaveBeenCalledWith(TelemetryEvent.example_event);
```
