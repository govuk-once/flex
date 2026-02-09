# Deployment Guide

CI/CD pipelines, environments and deployment workflows for FLEX.

---

## Overview

FLEX uses a multi-stage deployment pipeline with ephemeral and persistent environments.

### Environments

| Environment | Stage Pattern | Persistence | Core Stack | Deployed By |
| ----------- | ------------- | ----------- | ---------- | ----------- |
| Personal    | `$USER`       | Ephemeral   | Shared     | Developer   |
| PR          | `pr-{number}` | Ephemeral   | Shared     | CI/CD       |
| Development | `development` | Persistent  | Dedicated  | CI/CD       |
| Staging     | `staging`     | Persistent  | Dedicated  | CI/CD       |
| Production  | `production`  | Persistent  | Dedicated  | CI/CD       |

### Stack Dependencies

```text
@platform/core: VPC, subnets, security groups, VPC endpoints, ElastiCache
       │
       ▼
@platform/flex: API Gateway, CloudFront, Lambda functions, Domain routes
```

Ephemeral environments (personal, PR) share the `development` core stack. Persistent environments have dedicated core infrastructure.

---

## Personal Environment

Deploy your own stack for local development and testing.

### Prerequisites

Complete the ["Environment Setup"](/docs/environment-setup.md) steps first.

### Deploy

```bash
pnpm --filter @platform/flex deploy
```

This uses `$USER` as the stage name (truncated to 12 characters). Your stack will be named `{user}-FlexPlatform`.

### Verify

After deployment:

```bash
# Check stack outputs
pnpm --filter @platform/flex diff

# Run E2E tests against deployed infrastructure
pnpm --filter @flex/e2e test:e2e
```

### Destroy

```bash
pnpm --filter @platform/flex destroy
```

> Personal environments use the shared `development` core stack. VPC-attached Lambdas work because they reference SSM parameters from the development core stack.

---

## PR Environments

PR environments are created automatically when a pull request is opened against `main`.

### Lifecycle

```text
PR Opened/Updated  → Quality checks → Deploy pr-{number} → E2E tests
PR Closed          → Destroy pr-{number} stack
```

Quality checks and ephemeral deployment run in parallel. The ephemeral environment is destroyed when the PR is closed or merged.

### Naming

PR environments use the stage pattern `pr-{number}`, e.g., `pr-123-FlexPlatform`.

---

## Persistent Environments

Persistent environments have dedicated infrastructure deployed via CI/CD on merge to `main`.

### Deployment Flow

```text
merge to main → Quality Checks → Deploy to "development" → Deploy to "staging"
```

Each deployment includes E2E tests that must pass before proceeding to the next step.

### Core Stack Deployment

The `@platform/core` stack deploys to persistent environments only. The workflow attempts deployment for all stages but the stack's `stage_guard.sh` script ensures it only executes for known environments.

Core infrastructure includes:

- VPC with public, private egress, and private isolated subnets
- Security groups for private egress and private isolated Lambdas
- VPC endpoints (API Gateway, CloudWatch Logs, Secrets Manager)
- ElastiCache Redis cluster

---

## CI/CD Workflows

### Quality Checks

**Workflow:** [`_qualityChecks.yml`](/.github/workflows/_qualityChecks.yml)

**Triggers:** Called by PR and main workflows

**Steps:**

1. Install dependencies
2. Run pre-commit hooks
3. Lint all packages
4. Build all packages
5. Run unit tests
6. Run security scan using checkov
7. Run sonarqube static analysis

### Build and Deploy

**Workflow:** [`_buildDeploy.yml`](/.github/workflows/_buildDeploy.yml)

**Triggers:** Called by PR and main workflows

**Steps:**

1. Install dependencies
2. Configure AWS credentials via OIDC
3. Deploy `@platform/core`
4. Deploy `@platform/flex`
5. Run E2E tests

### Release Candidate (PR Pipeline)

**Workflow:** [`ci.yml`](/.github/workflows/ci.yml)

**Triggers:** Pull request opened or updated against `main`

**Jobs:**

| Job                   | Stage         |
| --------------------- | ------------- |
| Quality Checks        | `development` |
| Ephemeral Environment | `pr-{number}` |

Both jobs run in parallel. The ephemeral environment deployment uses the PR number to create an isolated stack.

### Continuous Deployment (Main Pipeline)

**Workflow:** [`main.yml`](/.github/workflows/main.yml)

**Triggers:** Push to `main` branch

**Jobs:**

| Job                   | Stage         | Depends On            |
| --------------------- | ------------- | --------------------- |
| Quality Checks        | `development` | —                     |
| Deploy to Development | `development` | Quality Checks        |
| Deploy to Staging     | `staging`     | Deploy to Development |

Each stage must complete before the next step begins. E2E tests run as part of each deployment.

### Destroy Ephemeral Environment

**Workflow:** [`destroyEphemeralEnv.yml`](/.github/workflows/destroyEphemeralEnv.yml)

**Triggers:** Pull request closed (merged or abandoned)

**Steps:**

1. Configure AWS credentials
2. Destroy `@platform/flex` stack for `pr-{number}`

---

## Manual Deployment

### Deploying to a Specific Stage

```bash
STAGE=development pnpm --filter @platform/<name> deploy
```

### Deploying Core Stack

Core stack deployment only succeeds for persistent stages:

```bash
STAGE=development pnpm --filter @platform/core deploy
```

Ephemeral stages skip core deployment via [`stage_guard.sh`](/platform/infra/core/scripts/stage_guard.sh).

### Comparing Changes

Preview changes before deploying:

```bash
pnpm --filter @platform/flex diff
```

### Hotswap Deployment

For faster iteration when only Lambda code has changed:

```bash
pnpm --filter @platform/flex hotswap
```

Hotswap updates Lambda code directly without a full CloudFormation deployment. Use only for code changes, do not use for infrastructure changes.

---

## Troubleshooting

### Core stack not found

**Symptom:** `@platform/flex` deployment fails with missing VPC or security group references.

**Cause:** SSM parameters from `@platform/core` don't exist for your stage.

**Solution:**

- Personal/PR environments use the `development` core stack. Verify that development core infrastructure is deployed.
- Persistent environments require their own core stack. Deploy `@platform/core` first.

### E2E tests fail with connection errors

**Symptom:** E2E tests cannot connect to API Gateway or CloudFront.

**Cause:** Stack outputs are missing or incorrect.

**Solution:**

Verify stack outputs exist:

```bash
aws cloudformation describe-stacks \
  --stack-name ${STAGE}-FlexPlatform \
  --query 'Stacks[0].Outputs'
```

---

## Related

**FLEX:**

- [@flex/e2e](/tests/e2e/README.md)
- [@platform/core](/platform/infra/core/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
- [@platform/gov-uk-once](/platform/infra/gov-uk-once/README.md)

**Guides:**

- [Environment Setup](/docs/environment-setup.md)
- [Domain Development Guide](/docs/domain-development.md)
- [Platform Development Guide](/docs/platform-development.md)
