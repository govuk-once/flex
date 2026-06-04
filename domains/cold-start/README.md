# cold-start domain

A dev-only lab for measuring Lambda cold starts, including how they stack when
one function synchronously calls another. Deployed only to `development`.

## Endpoint

`GET /v1/cascade?delays=<csv>`

- `delays`: comma-separated per-hop blocking times in **milliseconds**, e.g.
  `delays=0,500,500`. The list length is the cascade depth (1 to 10).
- A value of `0` means do not block, pass straight to the next hop.
- An optional `hop` query param is the internal hop counter; it defaults to 0
  and is incremented automatically on each recursive call. You normally do not
  set it.

Each hop waits its own time, removes the first value from the list, and calls
itself with the remainder. Because each parent stays open while awaiting its
child, every recursion lands on a fresh concurrent execution environment, so a
single call produces a chain of genuine cold starts.

The response is a nested tree, one level per hop:

```json
{
  "hop": 0,
  "cold": true,
  "waitedMs": 0,
  "initAgeMs": 12,
  "next": {
    "hop": 1,
    "cold": true,
    "waitedMs": 500,
    "initAgeMs": 8,
    "next": null
  }
}
```

## How the hops are wired

- Hop 0 is the **public** function. The platform applies the Cognito Lambda
  authoriser to all public routes, so calling the entry needs a valid bearer
  token (use the existing performance-test token generator). This means the
  authoriser cold start is included in the measurement.
- Hops 1..N go through the **private** API gateway (sigv4) and hit the private
  function. Each blocked parent forces a new concurrent environment, so each is
  cold.

## Constraints

- Both the public entry and every private hop go through API Gateway, which has
  a hard **29 second integration timeout**. Keep the sum of `delays` (plus
  per-hop overhead) under ~29s or the gateway returns 504. The Lambda cold
  starts still happen and still appear in the logs.
- The Lambda timeout is 30s, memory 128 MB, access private-egress, Node 24, with
  X-Ray active, matching the real platform handlers so the numbers are
  representative.

## Finding the logs

Every log line carries `marker: "cold-start-lab"`. In CloudWatch Logs Insights:

```
filter marker = "cold-start-lab"
| sort @timestamp asc
| display @timestamp, hop, phase, cold, waitMs, initAgeMs
```

Each hop emits `enter`, `call-next` (if it has a downstream), and `complete`.
Cross-check `cold` against the `@initDuration` field on the `REPORT` lines.
