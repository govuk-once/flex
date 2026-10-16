---
title: Troubleshooting
description: How to handle issues with setup steps
sidebar:
  order: 3
---

List of issues that may arise during setup and usage of Flex. Please feel free to update as necessary.

## Installation

Issues that may arise during initial setup.

### Node.js version mismatch

Switch to the version specified in `.nvmrc`

```bash
nvm use
```

### `pnpm install` refuses a recently published package

The workspace sets `minimumReleaseAge` to seven days, so very new versions are rejected on purpose. Pin an older version of the dependency.

### `pnpm install` fails with peer dependency errors

Force installation to bypass peer dependency conflicts

```bash
pnpm install --force
```

## Development

Issues that may arise during development.

### `pre-commit` hooks don't run

Reinstall them for all configured hook types

```bash
pre-commit install --install-hooks
```

### AWS credentials expired

Re-authenticate and export fresh credentials with the `gds-cli`

```bash
# Export credentials for a role into your shell
gds-cli aws once-bl-development-admin -e
```
