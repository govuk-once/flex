# Performance Tests

Artillery-based performance tests for the Flex API. Three scenarios: GET /todos list, GET /todos/:id, POST /todos/:id/duplicate.

## Local Usage

```bash
# Set required env vars
export BASE_URL=https://your-api-url
export STAGE=development   # or staging

# Build processor, run all scenarios, generate HTML reports
pnpm --filter @flex/performance-tests test:perf

# Or run a single scenario
pnpm --filter @flex/performance-tests build
pnpm --filter @flex/performance-tests test:todos-list
```

Reports written to `tests/performance/results/`:
- `*.json` — machine-readable Artillery metrics
- `*.html` — HTML reports (open in browser)

## CI Usage

Trigger manually via **Actions → Performance Tests → Run workflow**. Select `STAGE` (development/staging).

Threshold breaches are logged but do not fail the workflow (`continue-on-error: true`). Check the uploaded artifact for full reports.

## Thresholds

| Scenario | p95 | Error rate |
|----------|-----|------------|
| todos-list | 1000ms | <1% |
| todos-get | 1000ms | <1% |
| todos-post | 1500ms | <1% |

Threshold breach causes a non-zero Artillery exit code locally (expected). See `scenarios/*.yml` to adjust.

## Adding Scenarios

1. Add `scenarios/<name>.yml` following the existing pattern
2. Add `test:<name>` and update `report` + `test:perf` scripts in `package.json`
3. Add a run step to `.github/workflows/performance-tests.yml`
