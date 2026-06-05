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
child, a depth-N call forces N execution environments to run **concurrently**.
Whether each one is a cold start depends on whether Lambda has a warm
environment to reuse: if you have been calling the endpoint repeatedly, the
early hops reuse warm containers and only the deepest hops are cold. To get
every hop cold, recycle the functions first (see Forcing cold starts below).

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
  function. Each blocked parent forces a new concurrent environment.

## Forcing cold starts

You cannot make a warm Lambda cold-start from an HTTP call; you can only force
concurrency. Coldness depends on whether a warm environment is free. Read it
from `initAgeMs` in the response: sub-second means a fresh, cold environment;
seconds means a reused warm one.

To start a run from zero warm environments, recycle the functions first:

```bash
STAGE=pr-334 pnpm cold-start:reset
```

This updates each cold-start function's configuration, which drains its warm
environments, so the next invocation of every hop cold-starts. It only adds a
throwaway `COLD_START_RESET_AT` variable (existing env is preserved), which the
next `cdk deploy` reconciles away.

## Measuring

End-to-end, all via npm scripts. The examples use this PR's environment
(`pr-334`); swap in your own stage if different.

```bash
STAGE=pr-334 pnpm cold-start:reset
STAGE=pr-334 DELAYS=200,200,200,200,200 pnpm cold-start:run
STAGE=pr-334 pnpm cold-start:metrics
```

`pnpm cold-start:run` resolves the API URL from the `${STAGE}-FlexGlobal` stack
output, gets a stub token, calls the cascade, and prints the response plus the
end-to-end request time. `DELAYS` defaults to `200,200,200,200,200`.

`pnpm cold-start:metrics` runs the per-function init-duration query
(`@initDuration` p50/p90/p99, max, and cold-start counts) over the cold-start
log groups for the last 60 minutes. Set `MINUTES` to change the window.

## Scripts

| Script                    | Purpose                                                               |
| ------------------------- | --------------------------------------------------------------------- |
| `pnpm cold-start:reset`   | Recycle the lab functions so the next call cold-starts.               |
| `pnpm cold-start:run`     | Resolve the URL, get a token, call the cascade, print the response.   |
| `pnpm cold-start:metrics` | Print per-function `@initDuration` percentiles and cold-start counts. |

The cold-start scripts take `STAGE` (default `development`) and `AWS_REGION`
(default `eu-west-2`). They use the AWS SDK (`scripts/coldStart*.ts`) and reuse
the e2e token client and `getStackOutputs`, not the CLI, so they are typed and
reviewable. `cold-start:run` also takes `DELAYS`.

`cold-start:metrics` also takes `STACK` (default `${STAGE}-cold-start`), so it
can read init durations from any FLEX stack, not just the lab. For example,
`STACK=pr-334-FlexPlatform pnpm cold-start:metrics` reports the real authoriser
and platform functions, and `STACK=pr-334-dvla pnpm cold-start:metrics` the DVLA
handlers.

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
Cross-check `cold` against the `@initDuration` field on the `REPORT` lines, or
just run `pnpm cold-start:metrics`.

X-Ray active tracing is on, so the trace for a call shows each hop's
`Initialization` subsegment (the cold start) in the timeline.
