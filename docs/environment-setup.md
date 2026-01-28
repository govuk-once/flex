# Environment Setup

Setting up your local environment for FLEX.

---

## Prerequisites

| Tool       | Version                 |
| ---------- | ----------------------- |
| Node.js    | See [`.nvmrc`](/.nvmrc) |
| PNPM       | 10+                     |
| pre-commit | 4.x                     |
| checkov    | 3.x                     |
| AWS CLI    | 2.x                     |
| GDS CLI    | 5.x                     |

### Node.js

Install via [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install
nvm use
```

### PNPM

Install globally:

```bash
npm install -g pnpm@latest
```

### pre-commit

macOS:

```bash
brew install pre-commit
```

Other platforms: See [pre-commit.com](https://pre-commit.com/#installation)

### checkov

pipx (recommended):

```bash
pipx install checkov
```

Homebrew (macOS):

```bash
brew install checkov
```

pip:

```bash
pip install checkov
```

---

## AWS Credentials

FLEX requires AWS credentials to deploy infrastructure and run E2E tests.

### AWS Configuration using GDS CLI

Follow the [GDS CLI getting started guide](https://docs.publishing.service.gov.uk/manual/get-started.html) to configure your credentials.

Follow the [GOV.UK Once laptop configuration](https://github.com/govuk-once/laptop-configuration/) instructions to install the required dependencies for your laptop.

Once set up, you can then run AWS commands via the GDS CLI:

```bash
gds-cli aws <command>

# Format for assuming a role
gds-cli aws once-<team>-<environment>-<role> -<action>

# Export credentials to assume specific role
gds-cli aws once-bl-development-admin -e

# Log into AWS management console
gds-cli aws once-bl-development-admin -l
```

### Verify AWS Access

Verify your identity and target account are correct:

```bash
aws sts get-caller-identity
```

---

## Repository Setup

After cloning the repository, install dependencies and verify everything works locally:

```bash
# Install dependencies
pnpm install

# Install pre-commit hooks
pre-commit install

# Verify setup
pnpm test
```

---

## IDE Configuration

### VS Code

Recommended extensions are defined in `.vscode/extensions.json`. VS Code will prompt to install them when opening the repository.

Key extensions:

- ESLint
- Prettier

Settings are pre-configured in `.vscode/settings.json` for consistent formatting across the team.

### Other IDEs

Ensure your IDE respects:

- ESLint configuration for linting
- Prettier for code formatting

---

## Environment Variables

Most development tasks don't require environment variables. The following are only needed for specific scenarios:

| Variable     | When Needed           | Description                            |
| ------------ | --------------------- | -------------------------------------- |
| `STAGE`      | Deployment, E2E tests | Deployment stage (defaults to `$USER`) |
| `AWS_REGION` | Deployment, E2E tests | AWS region (set by GDS CLI)            |

See [@flex/e2e](/tests/e2e/README.md) for E2E-specific environment variables.

---

## Troubleshooting

### `pnpm install` fails with peer dependency errors

Force installation to bypass peer dependency conflicts:

```bash
pnpm install --force
```

### `pre-commit` hooks not running

Reinstall hooks including all configured hook types:

```bash
pre-commit install --install-hooks
```

### AWS credentials expired

Re-authenticate and export fresh session credentials via GDS CLI.

### Node.js version mismatch

Switch to the version specified in `.nvmrc`:

```bash
nvm use
```

---

## Related

**Guides:**

- [Deployment Guide](/docs/deployment.md)
- [Domain Development Guide](/docs/domain-development.md)
- [Platform Development Guide](/docs/platform-development.md)
