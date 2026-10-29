---
title: Working in the repo
description: How commands run across the workspace, how to run one package, and how to get a token.
sidebar:
  order: 4
---

Flex is one pnpm workspace, with Nx running package scripts across it. For where things live, see the [Repository tour](/flex/introduction/repository-tour/).

## Commands

Root scripts are defined in the root [`package.json`](https://github.com/govuk-once/flex/blob/main/package.json) and described in [Commands and scripts](/flex/reference/commands/). Use pnpm and the existing scripts. When a tool has no script, use `pnpm exec`.

### Affected packages

`pnpm lint`, `pnpm tsc`, `pnpm test` and `pnpm checkov` use `nx affected`. They run only in packages that changed since `main`, including uncommitted changes, and in the packages that depend on them. To run a target in every package:

```bash
pnpm exec nx run-many --target=test --all --run
```

### One package

Use `pnpm --filter <name> <script>`, or run `pnpm <script>` inside the package's directory:

```bash
pnpm --filter @flex/sdk test --run
```

A package's `test` script runs Vitest in watch mode. Add `--run` to run the tests once.

### Deploying

Use `pnpm run deploy`. It runs the root `deploy` script, which generates the OpenAPI documents and then deploys your stage.

:::tip
pnpm also has a built-in `deploy` command that does something unrelated, so always include `run`. See [Environments](/flex/delivery/environments/).
:::

## Getting a token

A public route needs a bearer token in the `Authorization` header.

- `pnpm jwt` prints a token for a deployed stage and needs AWS credentials. See [Your first domain](/flex/getting-started/your-first-domain/#8-make-requests-by-hand).
- `pnpm jwt:playground` prints a token for your own One Login test account and doesn't use AWS. Copy [`.env.playground.example`](https://github.com/govuk-once/flex/blob/main/.env.playground.example) to `.env`, fill it in and run the command. Git ignores `.env`, so never commit it. The script lists any missing values.

## Libraries have no build step

Workspace packages export their TypeScript sources directly, so type checks and tests see a change in a dependency straight away. Lambda code is bundled when the CDK app synthesises.

## Adding a shared library

Shared libraries live in `libs/` and are named `@flex/<name>`. Copy a small existing library, rename it, then run `pnpm install` from the root to link it. The shared configuration each library extends is described in [`@flex/config`](https://github.com/govuk-once/flex/tree/main/libs/config).
