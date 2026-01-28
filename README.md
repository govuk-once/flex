# FLEX (Federated Logic and Events eXchange System)

<!-- TODO: Brief description of what FLEX is and what it provides -->

## Overview

<!-- TODO: High-level explanation of the platform architecture -->

## Developer Roles

| Role | Access | Focus |
|------|-------------|--------|
| **Platform** | Full repository | Infrastructure, shared libraries |
| **Domain** | `domains/<name>/*` | Domain-specific application code |

## Quick Start

### Prerequisites

1. **Node.js**: Install via [nvm](https://github.com/nvm-sh/nvm), then run `nvm use` in the repository root
2. **PNPM (v10+)**: [Installation guide](https://pnpm.io/installation)
3. **pre-commit**: `brew install pre-commit` (macOS) or see [pre-commit.com](https://pre-commit.com/)
4. **checkov**: Required for Infrastructure as Code linting. Install via:
   - pipx (recommended): `pipx install checkov`
   - pip: `pip install checkov`
   - Homebrew (macOS): `brew install checkov`
5. **AWS CLI**: Configured with appropriate credentials

### Setup

```bash
# Install dependencies
pnpm install

# Install pre-commit hooks
pre-commit install

# Verify setup
pnpm test
```

For detailed environment setup and configuration instructions, see [Environment Configuration](docs/environment-configuration.md).

## Repository Structure

```text
flex/
├── docs/            # Development guides and reference documentation
├── domains/
│   └── <domain>/    # Domain-specific handlers and application code
├── libs/            # Shared packages (@flex/*)
├── platform/
│   ├── domains/     # Platform-level handlers
│   └── infra/       # Platform Infrastructure as Code (CDK) stacks and constructs
└── tests/
    └── e2e/         # Tests against deployed infrastructure
```

## Packages

| Package | Description |
|---------|-------------|
| [`@flex/config`](libs/config/README.md) | Shared ESLint, TypeScript and Vitest configuration |
| [`@flex/handlers`](libs/handlers/README.md) | Lambda handler utilities and factories |
| [`@flex/logging`](libs/logging/README.md) | Structured logging utilities |
| [`@flex/middlewares`](libs/middlewares/README.md) | Shared handler middleware |
| [`@flex/testing`](libs/testing/README.md) | Test fixtures, matchers and utilities |
| [`@flex/utils`](libs/utils/README.md) | Shared types, Zod schemas, helpers and OpenAPI specifications |

## Developer Guides

- [Platform Development Guide](docs/platform-development.md): For platform developers maintaining infrastructure and shared libraries
- [Domain Development Guide](docs/domain-development.md): For domain developers building application code
- [Testing Guide](docs/testing.md): Testing patterns and best practices
- [Deployment and CI/CD](docs/deployment.md): Pipeline stages, environments and configuration parameters
- [Documentation Guide](docs/documentation-guide.md): Standards and templates for writing documentation

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for commit message conventions and pull request guidelines.
