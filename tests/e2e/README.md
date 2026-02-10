# @flex/e2e

End-to-end tests for the FLEX platform running against deployed infrastructure.

## Commands

Run these from the repository root:

| Command                                              | Description                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm --filter @flex/e2e lint`                       | Lint files                                                       |
| `pnpm --filter @flex/e2e test:e2e`                   | Run tests (assumes you have set environment variables in `.env`) |
| `STAGE=development pnpm --filter @flex/e2e test:e2e` | Run tests with manual environment variables                      |
| `pnpm --filter @flex/e2e tsc`                        | Run type check                                                   |

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

| Variable                      | Required | Description                                             |
| ----------------------------- | -------- | ------------------------------------------------------- |
| `STAGE`                       | No       | Deployment stage (defaults to `$USER` or `development`) |
| `AWS_REGION`                  | No       | AWS region (automatically set by GDS CLI)               |
| `CLOUDFRONT_DISTRIBUTION_URL` | No       | Manual override for CloudFront URL                      |

> If not using GDS CLI to assume roles, set `AWS_REGION` manually (e.g., `eu-west-2`).

### Running Locally

1. Assume a role via GDS CLI with access to the target AWS account
2. Run tests using one of the options below

#### Option A: Automatic Resolution (Recommended)

Environment variables are resolved from CloudFormation stack outputs based on `STAGE`. Defaults to `$USER` if no stage is set:

```bash
pnpm --filter @flex/e2e test:e2e
```

#### Option B: Manual Override

Set environment variables directly to skip CloudFormation lookup:

```bash
CLOUDFRONT_DISTRIBUTION_URL=https://xxx.cloudfront.net pnpm --filter @flex/e2e test:e2e
```

> When manually overriding, all required variables must be provided together.

#### Using a `.env` File

Create a `.env` file in `tests/e2e/`:

```bash
STAGE=development
CLOUDFRONT_DISTRIBUTION_URL=https://xxx.cloudfront.net
```

> E2E tests run automatically in CI after each deployment. See the [Deployment Guide](/docs/deployment.md) for details.

---

## Directory Structure

```text
tests/e2e/
  src/
    domains/          # Domain-specific E2E tests
      <domain>.test.ts
    platform/         # Platform E2E tests
      <name>.test.ts
    setup.global.ts   # Global test setup
```

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
