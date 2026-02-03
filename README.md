# FLEX (Federated Logic and Events eXchange System)

Serverless platform for GOV.UK One services built on AWS CDK and TypeScript.

---

## Quick Start

```bash
# Configure Node.js version
nvm use

# Install dependencies
pnpm install

# Install pre commit hooks
pre-commit install

# Verify local setup
pnpm test
```

See the [Environment Setup](/docs/environment-setup.md) for prerequisites and detailed configuration.

---

## Developer Roles

| Role         | Access             | Guide                                                       |
| ------------ | ------------------ | ----------------------------------------------------------- |
| **Platform** | Full repository    | [Platform Development Guide](/docs/platform-development.md) |
| **Domain**   | `domains/<name>/*` | [Domain Development Guide](/docs/domain-development.md)     |

---

## Repository Structure

```text
flex/
├── docs/                # Development guides
├── domains/             # Domain-specific handlers
├── libs/                # Shared packages (@flex/*)
├── platform/
│   ├── domains/         # Platform-level handlers
│   └── infra/           # CDK stacks and constructs
└── tests/
    └── e2e/             # E2E tests against deployed infrastructure
```

---

## Packages

| Package                                            | Description                                                  |
| -------------------------------------------------- | ------------------------------------------------------------ |
| [`@flex/config`](/libs/config/README.md)           | Shared ESLint, TypeScript and Vitest configuration           |
| [`@flex/handlers`](/libs/handlers/README.md)       | Lambda handler factory with Middy middleware                 |
| [`@flex/logging`](/libs/logging/README.md)         | Structured logging via AWS Lambda Powertools                 |
| [`@flex/middlewares`](/libs/middlewares/README.md) | Shared Middy middleware                                      |
| [`@flex/params`](/libs/params/README.md)           | Environment variable validation and SSM parameter resolution |
| [`@flex/testing`](/libs/testing/README.md)         | Test fixtures, helpers and extended test functions           |
| [`@flex/utils`](/libs/utils/README.md)             | Shared schemas, types and HTTP utilities                     |

---

## Domains

| Domain                                           | Description                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| [`@flex/hello-domain`](/domains/hello/README.md) | Example domain demonstrating Lambda deployment patterns |
| [`@flex/udp-domain`](/domains/udp/README.md)     | User Data Platform for user settings management         |

---

## Platform

### Domain Handlers

| Handler                                                        | Description                                    |
| -------------------------------------------------------------- | ---------------------------------------------- |
| [`@platform/auth`](/platform/domains/auth/README.md)           | Lambda authorizer for Cognito JWT verification |
| [`@platform/fail-fast`](/platform/domains/fail-fast/README.md) | CloudFront Function for structural validation  |

### Infrastructure

| Stack                                                            | Description                                               |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| [`@platform/core`](/platform/infra/core/README.md)               | VPC, subnets, security groups, VPC endpoints and cache    |
| [`@platform/flex`](/platform/infra/flex/README.md)               | API Gateway, CloudFront, Lambda constructs and routes     |
| [`@platform/gov-uk-once`](/platform/infra/gov-uk-once/README.md) | Base CDK stack with GDS tagging and environment utilities |

---

## Tests

| Package                             | Description                               |
| ----------------------------------- | ----------------------------------------- |
| [`@flex/e2e`](/tests/e2e/README.md) | E2E tests against deployed infrastructure |

---

## Guides

| Guide                                                       | Description                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| [Environment Setup](/docs/environment-setup.md)             | Prerequisites and local environment configuration                     |
| [Platform Development Guide](/docs/platform-development.md) | Maintaining infrastructure and shared libraries                       |
| [Domain Development Guide](/docs/domain-development.md)     | Building application code within a domain                             |
| [Deployment Guide](/docs/deployment.md)                     | CI/CD pipelines, environments and deployment workflows                |
| [Developer Reference](/docs/developer-reference.md)         | Common patterns, best practices and workflows when developing on FLEX |
| [Documentation Guide](/docs/documentation-guide.md)         | Standards and templates for writing documentation                     |

---

## Contributing

See [CONTRIBUTING.md](/.github/CONTRIBUTING.md) for commit message conventions and pull request guidelines.
