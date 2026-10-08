---
title: Performance tests
description: The Artillery performance tests for the UDP user endpoints, their load profiles, and how to run them locally and in CI.
---

`tests/performance` (`@flex/performance-tests`) holds [Artillery](https://www.artillery.io/) tests
for the user endpoints of the `udp` domain. They run against development or staging, never in the
pipeline.

## Scenarios

| Scenario | Request | Users warmed first | p95 threshold | Error rate threshold |
| --- | --- | --- | --- | --- |
| `user-upsert` | `GET /app/udp/v1/users/me` | No | 3000 ms | 1% |
| `user-get` | `GET /app/udp/v1/users/me` | Yes | 1500 ms | 1% |
| `user-settings` | `PATCH /app/udp/v1/users/notifications` | Yes | 1500 ms | 1% |

- **user-upsert** measures the upsert under load. Each token in the pool has a fixed subject, so
  the first pass creates users and later passes find them, as in production, where nearly every
  request is from a returning user.
- **user-get** measures retrieval only. Every pool user is created before the test starts.
- **user-settings** measures the notification settings update, with users created first.

Each scenario file runs 30 seconds of warm-up at 1 arrival a second, a 60 second ramp to 10 a
second, then 120 seconds at 10 a second, with at most 25 virtual users. Artillery exits with an
error when a threshold is breached.

## Load profiles

A profile reuses a scenario with a different phase configuration from a `*.config.yml` file.

| Command | Scenarios | Token pool | Shape |
| --- | --- | --- | --- |
| `pnpm test:users` | All three | 50 | The scenarios' own phases, then the report |
| `pnpm test:smoke:users` | All three | 2 | 15 seconds at 1 arrival a second |
| `pnpm test:load-baseline` | All three | 50 | 60 s warm-up at 3/s, then 300 s at 15/s, up to 50 users |
| `pnpm test:load-growth` | All three | 150 | 120 s ramp from 15/s to 50/s, then 300 s at 50/s, up to 150 users |
| `pnpm test:stress` | `user-upsert` | 2000 | Ramps from 15/s to 1000/s over 8 minutes, up to 2000 users. No thresholds: it is for observation |
| `pnpm test:spike` | `user-upsert` | 500 | 60 s at 5/s, a 15 s spike to 200/s held for 120 s, a drop, then 120 s recovery |
| `pnpm test:soak` | `user-get` | 50 | 75 minutes at 1 arrival a second, one user at a time |

Each profile command also has a per-scenario form, such as `pnpm test:load-baseline:user-get`, and
`pnpm test:user-upsert` runs one scenario with its own phases.

The smoke and load profiles publish metrics and traces to CloudWatch, in the
`flex/performance-tests` namespace with a `Stage` dimension, and most add a `TestType` dimension.
The plain scenario commands do not.

## Tokens

The tests build a pool of access tokens before they start.

| Stage | Tokens |
| --- | --- |
| `development` | Stub tokens for subjects `flex-000000000000`, `flex-000000000001` and so on, signed with the key in `/development/flex-secret/auth/e2e/private_jwk`. Set `PERF_PRIVATE_JWK` to the JWK as a JSON string to skip Secrets Manager |
| `staging` | One real token for the E2E test user, shared by every virtual user |

On staging every virtual user is the same person, so the results measure endpoint throughput, not
behaviour under many concurrent users.

The `flex-` prefix makes test users easy to find in UDP. They are not removed after a run.

## Running locally

Assume a role for the target account (see
[AWS credentials](/flex/start/environment-setup/#aws-credentials)), then from `tests/performance`:

```bash
export BASE_URL=https://<api domain>   # no trailing slash
export STAGE=development               # or staging
pnpm test:users
```

| Variable | Purpose |
| --- | --- |
| `BASE_URL` | The API to test |
| `STAGE` | `development` or `staging`. Decides how tokens are made |
| `PERF_POOL_SIZE` | Number of tokens. Each command sets its own |
| `PERF_WARM_USERS` | `true` calls `GET /app/udp/v1/users/me` for every pool user before the test |
| `PERF_PRIVATE_JWK` | A signing key, to skip Secrets Manager on development |
| `AWS_REGION` | Region for CloudWatch metrics and the report |
| `LAMBDA_FUNCTION_NAMES` | Comma-separated Lambda function names. With `AWS_REGION`, the report adds their CloudWatch metrics for the test window |

## Results

Artillery writes JSON results to `tests/performance/results/`. `pnpm report` turns every result
file there into `results/combined-report.html`. Git ignores the results.

## In CI

**Actions → Performance Tests → Run workflow** runs the tests. It needs write access to the
repository. Choose `development` or `staging`.

The workflow:

1. Runs `user-upsert`, `user-get` and `user-settings` as three parallel jobs, each with the
   scenario's own phases. Their load overlaps.
2. Targets `https://` followed by the hosted zone name in the SSM parameter
   `/infra/dns/hostedzonename`, which is the persistent API for that account.
3. Uploads each JSON result, then builds the combined report and uploads it as
   `performance-results-<stage>-<run id>`, kept for 30 days.

The jobs run in the GitHub environment for the chosen stage, so a staging run waits for an
[approval](/flex/delivery/pipeline/#approvals) and can only start from a protected branch. A
breached threshold does not fail the workflow: read the report.
