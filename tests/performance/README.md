# Performance Tests

Artillery-based performance tests for the Flex User API. Three scenarios: GET /users (upsert under load), GET /users (warmed retrieval), PATCH /users/notifications (settings).

## Local Usage

```bash
export BASE_URL=https://your-api-url
export STAGE=development   # or staging

# Run all user scenarios and generate HTML report
pnpm test:users

# Run a single scenario
pnpm test:user-upsert
pnpm test:user-get
pnpm test:user-settings

# Smoke (2 users, cloudwatch config)
pnpm test:smoke:users

# Load profiles
pnpm test:load-baseline   # 50 users, sustained load
pnpm test:load-growth     # 150 users, ramping load
pnpm test:stress          # 2000 users
pnpm test:spike           # 500 users, spike pattern
pnpm test:soak            # 50 users, 30 min

# Generate HTML report from existing result files
pnpm report
```

Reports written to `tests/performance/results/`:
- `*.json` — machine-readable Artillery output
- `combined-report.html` — HTML report (open in browser)

## Scenario intent

| Scenario | Endpoint | Intent |
|---|---|---|
| user-upsert | `GET /users` | Measures the upsert endpoint under load. Each pool token has a deterministic sub; the first pass creates users, subsequent passes re-upsert existing ones. Tests realistic production traffic where >99% of requests are returning users. |
| user-get | `GET /users` | Measures pure retrieval. Pool users are pre-warmed before the test so every request hits an existing user. |
| user-settings | `PATCH /users/notifications` | Measures the settings update endpoint under load using pre-warmed users. |

## JWT Pool

On `development`, tokens are generated using a private key fetched from Secrets Manager (`/development/flex-secret/auth/e2e/private_jwk`). Set `PERF_PRIVATE_JWK` to a raw JWK JSON string to skip Secrets Manager.

On `staging`, a single real Cognito token is reused across all virtual users — all VUs run as the same identity. This is a known limitation; staging results measure endpoint throughput rather than per-user concurrency.

Set `PERF_WARM_USERS=true` to hit `GET /users` for each pool user before the test begins, ensuring all test users exist in the database.

## CloudWatch Lambda Metrics

Set `LAMBDA_FUNCTION_NAMES` (comma-separated) and `AWS_REGION` to include a Lambda section in the HTML report. Omit them to skip it.

## CI Usage

Trigger manually via **Actions → Performance Tests → Run workflow**. Requires write access to the repository. Select `STAGE` (development/staging).

Threshold breaches are logged but do not fail the workflow (`continue-on-error: true`). Check the uploaded artifact for full reports.

## Thresholds

| Scenario        | p95    | Error rate |
|-----------------|--------|------------|
| user-upsert     | 3000ms | <1%        |
| user-get        | 1500ms | <1%        |
| user-settings   | 1500ms | <1%        |
