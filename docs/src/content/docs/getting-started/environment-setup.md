---
title: Environment setup
description: Install the tools, get AWS access and check your local setup works.
sidebar:
  order: 1
---

You can write code and run unit tests with just the tools on this page. Deploying a personal stack and running E2E tests requires AWS access, covered below.

## Prerequisites

| Tool       | Version                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js    | The version in [`.nvmrc`](https://github.com/govuk-once/flex/blob/main/.nvmrc)                                                             |
| pnpm       | Switches to the version pinned in `packageManager` in the root [`package.json`](https://github.com/govuk-once/flex/blob/main/package.json) |
| pre-commit | `4.x`                                                                                                                                      |
| checkov    | `3.x`                                                                                                                                      |
| AWS CLI    | `2.x`                                                                                                                                      |
| GDS CLI    | `5.x`                                                                                                                                      |

### Node.js

Install with [nvm](https://github.com/nvm-sh/nvm)

```bash
nvm install
nvm use
```

### PNPM

Install globally - [pnpm.io](https://pnpm.io/installation)

```bash
npm install -g pnpm@latest
```

The root `package.json` pins an exact pnpm version in its `packageManager` field. pnpm switches to that version when you run it in the repository, so everyone uses the same one.

### pre-commit

Install for OS - [pre-commit.com](https://pre-commit.com/#installation)

```bash
# Homebrew (macOS)
brew install pre-commit
```

### checkov

Install for OS

```bash
# pip (recommended)
pipx install checkov

# Homebrew (macOS)
brew install checkov

# pip
pip install checkov
```

## Set up the repository

After cloning and prerequisite steps:

```bash
# Set node version
nvm use

# Install dependencies
pnpm install

# Install pre-commit hooks
pre-commit install

# Verify setup
# Runs the unit tests for packages affected by your changes.
# If it passes, your local setup is good.
pnpm test
```

## AWS access

You don't need AWS credentials to write code or run unit tests. The tests set their own dummy credentials, so they pass whether or not you have a role assumed, and ignore any AWS variables in your shell. You _will_ need real credentials to:

- Deploy a personal stack
- Run E2E tests
- Generate tokens with `pnpm jwt`

Personal and PR environments live in the development account. Only use a staging or production role when you work on those environments.

### Setup the GDS CLI

We use the [`gds-cli`](https://github.com/alphagov/gds-cli) to assume AWS roles and access the console, rather than the `aws cli` directly.

Follow the ["Install and configure the GDS CLI" guide](https://docs.publishing.service.gov.uk/manual/get-started.html#7-install-and-configure-the-gds-cli) to install and configure your credentials.

### Assuming a role in your shell

Once configured, you can assume a role in your shell using a command following this structure:

```bash
gds-cli aws once-<team>-<environment>-<role> -<action>
```

To assume the development role for this repo, follow these steps in the terminal window where you will run your `pnpm` commands. The credentials only apply to that one window, so a new tab or window needs the steps again.

1. Run the command to export credentials for the role:

```bash
gds-cli aws once-bl-development-admin -e
```

2. Authenticate if asked. You may need to give your aws-vault password and an MFA code.

3. Read the output. The command doesn't set anything in your shell itself. It prints a block of lines like the ones below, with real values in place of the `<placeholders>`. You don't need to edit anything. These lines are output for you to copy, not commands to type:

```bash
unset AWS_CREDENTIAL_FILE;
unset AWS_DEFAULT_PROFILE;
unset AWS_PROFILE;
export AWS_REGION='<aws-region>';
export AWS_DEFAULT_REGION='<aws-default-region>';
export AWS_ACCESS_KEY_ID='<aws-access-key-id>';
export AWS_SECRET_ACCESS_KEY='<aws-secret-access-key>';
export AWS_SESSION_TOKEN='<aws-session-token>';
```

4. Copy the whole block, paste it into the same terminal window and press Enter. Include the `unset` lines, which clear any profile settings that would override the new keys. Nothing is printed when it works.

5. Check that it worked:

```bash
aws sts get-caller-identity
# {
#    "UserId": "<user-id>",
#    "Account": "<account>",
#    "Arn": "<arn>"
# }
```

The `Arn` should contain `assumed-role`, and the `Account` should be the development account. An error here means the credentials didn't reach this window. Go back to step 4 and check you pasted into the right one.

Credentials expire, after 60 minutes by default. When a command fails with an expired token, or `pnpm jwt` prints `AWS credentials not found.`, export a fresh set.

Flex runs in `eu-west-2`, with CloudFront and the resources beside it in `us-east-1`. The CDK app sets each stack's region itself.

### Accessing the AWS console

To access the AWS console, run the following:

```bash
# Open the AWS management console
gds-cli aws once-bl-development-admin -l
```

## Environment variables

Most tasks need none. These matter when you deploy or run E2E tests:

| Variable     | When needed                       | Description                                               |
| ------------ | --------------------------------- | --------------------------------------------------------- |
| `STAGE`      | Deployment, E2E tests, `pnpm jwt` | The stage to target. Defaults to `$USER` when you deploy. |
| `AWS_REGION` | Deployment, E2E tests             | The AWS region. The GDS CLI sets it.                      |

Your personal stage name is `$USER` lowercased, with anything other than `a-z`, `0-9` and `-` removed, cut to 12 characters.

The [`@flex/e2e` README](https://github.com/govuk-once/flex/blob/main/tests/e2e/README.md) lists the variables specific to E2E tests. If E2E tests fail with `unable to get local issuer certificate`, see [Troubleshooting](/flex/getting-started/troubleshooting/#unable-to-get-local-issuer-certificate).

## Editor

The repository includes VS Code settings in `.vscode/`. It recommends the [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) extension, and VS Code offers to install it when you open the repository. The settings format on save using ESLint.

Prettier runs inside ESLint, so you don't need a separate Prettier extension. In other editors, run ESLint fixes on save.
