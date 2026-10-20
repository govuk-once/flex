---
title: Troubleshooting
description: How to handle issues with setup steps
sidebar:
  order: 5
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

## Development

Issues that may arise during development.

### `pre-commit` hooks don't run

Reinstall them for all configured hook types

```bash
pre-commit install --install-hooks
```

### `STAGE or USER env var not set`

Flex works out your stage from `STAGE`, or from `USER` if `STAGE` isn't set. It lowercases the value, removes anything other than `a-z`, `0-9` and `-`, and cuts it to 12 characters. The error means that left nothing. This has nothing to do with your AWS or GDS CLI sign-in.

Check what your shell has:

```bash
echo "USER=$USER STAGE=$STAGE"
```

Common causes are an unset `USER`, such as in a container, an empty `STAGE` (set but blank, which is used instead of `USER`), or a `USER` with no letters or numbers in it. Set a stage explicitly:

```bash
export STAGE=<your-name>
```

See [Environments](/flex/delivery/environments/) for how stages are named.

### AWS credentials expired

Re-authenticate and export fresh credentials with the `gds-cli`

```bash
# Export credentials for a role into your shell
gds-cli aws once-bl-development-admin -e
```
