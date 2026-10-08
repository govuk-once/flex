---
title: Environment setup
description: The tools you need to work on Flex, how to install them, and how to get AWS credentials.
---

This page gets your machine ready to build, test and deploy Flex. Lint, type checks and unit tests
need only Node.js and pnpm. Deploying, running E2E tests and generating a token also need AWS
credentials.

## Prerequisites

| Tool       | Version                                                     | Used for                                  |
| ---------- | ----------------------------------------------------------- | ----------------------------------------- |
| Node.js    | The version in [`.nvmrc`](https://github.com/govuk-once/flex/blob/main/.nvmrc) | Everything                                |
| pnpm       | The version in `packageManager` in the root `package.json`  | Installing dependencies, running scripts  |
| pre-commit | 4.x                                                         | Git hooks, including secret detection     |
| AWS CLI    | 2.x                                                         | Calling AWS                               |
| GDS CLI    | 5.x                                                         | Assuming AWS roles                        |
| checkov    | 3.x                                                         | `pnpm checkov`, the infrastructure scan   |

### Node.js

Install Node.js with [nvm](https://github.com/nvm-sh/nvm). From the repository root, this installs
and selects the version in `.nvmrc`:

```bash
nvm install
nvm use
```

### pnpm

Install pnpm globally:

```bash
npm install -g pnpm@latest
```

The root `package.json` pins an exact pnpm version in its `packageManager` field. pnpm switches to
that version when you run it in the repository, so everyone uses the same one.

### pre-commit

On macOS:

```bash
brew install pre-commit
```

On other platforms, see the [pre-commit installation guide](https://pre-commit.com/#installation).
The hooks are described in [Conventions](/flex/start/conventions/#pre-commit-hooks).

### checkov

You need checkov only to run `pnpm checkov` locally. CI runs it on every pull request.

```bash
pipx install checkov    # or: brew install checkov
```

### AWS CLI and GDS CLI

Follow the [GOV.UK Once laptop configuration](https://github.com/govuk-once/laptop-configuration/)
to install the AWS CLI, the GDS CLI and their dependencies. Then follow the
[GDS CLI getting started guide](https://docs.publishing.service.gov.uk/manual/get-started.html) to
set up your credentials.

## Set up the repository

```bash
git clone https://github.com/govuk-once/flex.git
cd flex
nvm use
pnpm install          # install dependencies and link the workspace packages
pre-commit install    # install the git hooks
pnpm test             # check that everything works
```

[Working in the repo](/flex/start/working-in-the-repo/) covers the commands you use day to day.

## AWS credentials

You need AWS credentials to deploy a stack, to run E2E tests and to generate a token with
`pnpm jwt`. Flex gets them from the GDS CLI, which assumes a role in a GOV.UK Once AWS account.
Role names follow the pattern `once-<team>-<environment>-<role>`. For example, to use the
development account:

```bash
# Export temporary credentials for the role into this shell
eval "$(gds-cli aws once-bl-development-admin -e)"

# Open the AWS console as the role
gds-cli aws once-bl-development-admin -l
```

Personal and PR environments live in the development account. Use the role for staging or
production only when you work on those environments.

Check which identity and account you are using before you deploy:

```bash
aws sts get-caller-identity
```

The credentials expire. When a command fails with an expired token, or `pnpm jwt` prints
`AWS credentials not found.`, export a fresh set.

Flex runs in `eu-west-2`, and its CloudFront stacks in `us-east-1`. The CDK app sets each stack's
region itself. Other variables that deploy and test commands read are listed in
[Environment variables](/flex/reference/environment-variables/).

## Editor

The repository includes settings for Visual Studio Code in `.vscode/`. It recommends one extension,
[ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint), and VS Code
offers to install it when you open the repository. The settings:

- format on save, with ESLint as the formatter for JavaScript, TypeScript, JSON, HTML and Markdown
- use the TypeScript version installed in the workspace

Prettier runs inside ESLint through `eslint-plugin-prettier`, so you do not need a separate
Prettier extension. In another editor, run ESLint's fixes on save and use the workspace's
TypeScript.

## Troubleshooting

| Problem                                              | Fix                                                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| The wrong Node.js version                            | Run `nvm use` in the repository root.                                                          |
| pre-commit hooks do not run                          | Run `pre-commit install --install-hooks`.                                                      |
| `STAGE or USER env var not set` from a CDK command   | Set `STAGE`, or make sure `USER` is set in your shell. See [Environments](/flex/delivery/environments/). |
| An expired token, or `AWS credentials not found.`    | Export fresh credentials with the GDS CLI.                                                     |
| `pnpm install` will not install a new release        | pnpm refuses package versions less than seven days old. See [Conventions](/flex/start/conventions/#dependencies). |
