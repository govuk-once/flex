# @flex/e2e

Platform end-to-end tests for the FLEX platform running against deployed
infrastructure.

> Domain (module) E2E tests are co-located with their domains under
> `domains/<name>/e2e/` and run via `pnpm --filter @flex/<name>-domain test:e2e`.
> This package holds only the platform-level suites (auth, private gateway).
> The shared E2E harness (global setup and the extended `it` fixture) lives in
> [@flex/testing/e2e](/libs/testing/README.md), and the route/domain deployment
> guards (`isDomainDeployed`, `isRouteDeployed`) live in `@flex/sdk`.

## Commands

Run these from the repository root:

| Command                                                       | Description                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm --filter @flex/e2e lint`                                | Lint files                                                       |
| `pnpm --filter @flex/e2e test:e2e:platform`                   | Run platform tests (assumes environment variables set in `.env`) |
| `STAGE=development pnpm --filter @flex/e2e test:e2e:platform` | Run platform tests with manual environment variables             |
| `pnpm --filter @flex/e2e tsc`                                 | Run type check                                                   |

Alternatively, run `pnpm <command>` from within `tests/e2e/`.

---

## Setup

E2E tests run against a deployed FLEX stack. Environment variables can be resolved automatically via CloudFormation or provided manually.

### Prerequisites

E2E tests require deployed infrastructure. Available environments:

| Environment | Stage Name                             | Provisioned By |
| ----------- | -------------------------------------- | -------------- |
| Personal    | `$USER` (truncated to 12 chars)        | Developer      |
| PR          | `pr-<number>`                          | CI/CD pipeline |
| Persistent  | `development`, `staging`, `production` | CI/CD pipeline |

For personal development, you must deploy your own stack before running E2E tests. See the [Deployment Guide](/docs/deployment.md) for instructions.

### Environment Variables

| Variable       | Required | Description                                             |
| -------------- | -------- | ------------------------------------------------------- |
| `STAGE`        | No       | Deployment stage (defaults to `$USER` or `development`) |
| `AWS_REGION`   | No       | AWS region (automatically set by GDS CLI)               |
| `FLEX_API_URL` | No       | Manual override for API URL                             |

> If not using GDS CLI to assume roles, set `AWS_REGION` manually (e.g., `eu-west-2`).

### Running Locally

1. Assume a role via GDS CLI with access to the target AWS account
2. Run tests using one of the options below

#### Option A: Automatic Resolution (Recommended)

Environment variables are resolved from CloudFormation stack outputs based on `STAGE`. Defaults to `$USER` if no stage is set:

```bash
pnpm --filter @flex/e2e test:e2e:platform
```

#### Option B: Manual Override

Set environment variables directly to skip CloudFormation lookup:

```bash
FLEX_API_URL=https://xxx.cloudfront.net pnpm --filter @flex/e2e test:e2e:platform
```

> When manually overriding, all required variables must be provided together.

#### Using a `.env` File

Create a `.env` file in `tests/e2e/`:

```bash
STAGE=development
FLEX_API_URL=https://xxx.cloudfront.net
```

> E2E tests run automatically in CI after each deployment. See the [Deployment Guide](/docs/deployment.md) for details.

---

## Directory Structure

```text
tests/e2e/
  src/
    platform/         # Platform E2E tests (auth, private gateway)
      <name>.test.ts
```

Domain E2E tests live with their domain:

```text
domains/<name>/
  e2e/
    <name>.test.ts    # Domain E2E tests, run via `test:e2e`
  vitest.e2e.config.ts
```

The shared global setup is provided by `@flex/testing/e2e/setup` and consumed by
each suite's vitest config.

---

## Writing Tests

Use the extended `it` function and fixtures from [@flex/testing/e2e](/libs/testing/README.md#it-e2e).

### Guidelines

- Tests run against real deployed infrastructure
- Each test should be independent, idempotent and test complete user flows
- Avoid tests that mutate shared state
- Use descriptive names explaining the scenario being tested
- Default test timeout is 30 seconds

---

## Related

**FLEX:**

- [@flex/testing](/libs/testing/README.md)
- [Deployment Guide](/docs/deployment.md)
