---
title: Working in the repo
description: The repository layout, the commands you use day to day, getting a token, adding a shared library and working on this site.
---

Flex is one pnpm workspace. Nx runs package scripts across it. Set up your machine first with
[Environment setup](/flex/start/environment-setup/).

Use pnpm and the existing scripts. When a tool has no script, use `pnpm exec`.

## Repository layout

```text
flex/
├── docs/                  this site (@flex/docs)
├── domains/               one package per domain (@flex/<name>-domain)
├── libs/                  shared libraries (@flex/*)
├── platform/
│   ├── domains/           platform handlers and service gateways
│   ├── infra/flex/        the CDK app (@platform/flex)
│   ├── shared/            helpers for platform code (@flex/platform-shared)
│   └── smoke-test/        the smoke test Lambda (@platform/smoke-test)
├── scripts/               root scripts: tokens, OpenAPI, release notes (@flex/scripts)
├── tests/
│   ├── e2e/               the platform E2E suite (@flex/e2e)
│   └── performance/       Artillery performance tests (@flex/performance-tests)
└── .github/               workflows, the pull request template and CODEOWNERS
```

Every workspace package, and what it holds, is listed in [Packages](/flex/reference/packages/).

## Root commands

Run these from the repository root.

| Command                        | What it does                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install`                 | Installs dependencies and links the workspace packages.                                                                              |
| `pnpm lint`                    | Runs ESLint in every affected package. Any warning fails it.                                                                         |
| `pnpm tsc`                     | Type checks every affected package.                                                                                                  |
| `pnpm test`                    | Runs the unit tests of every affected package, once.                                                                                 |
| `pnpm test:coverage`           | Runs the unit tests of every package that has a `test:coverage` script, with coverage.                                               |
| `pnpm test:e2e`                | Runs every package's `test:e2e` script: the module E2E tests. See [Testing domains](/flex/domains/testing/).                         |
| `pnpm checkov`                 | Synthesizes the CDK app and scans it with checkov, if `@platform/flex` is affected.                                                  |
| `pnpm validate:integrations`   | Checks that every integration a domain declares points at a route that exists. See [Integrations](/flex/domains/integrations/).      |
| `pnpm validate:macie-coverage` | Checks that every domain is listed in the Macie coverage configuration. See [Security scanning](/flex/delivery/security-scanning/).                   |
| `pnpm openapi:generate`        | Writes an OpenAPI document for each domain, and an index, to `dist/openapi/current`. See [OpenAPI](/flex/domains/openapi/).          |
| `pnpm docs:serve`              | Serves the generated documents in Swagger UI at `http://localhost:4400/docs/`. Run `pnpm openapi:generate` first.                    |
| `pnpm jwt`                     | Prints a token for calling a deployed stage. See [Getting a token](#getting-a-token).                                                |
| `pnpm jwt:playground`          | Prints a token for your own One Login test account. See [Getting a token](#getting-a-token).                                         |
| `pnpm run deploy`              | Generates the OpenAPI documents, then deploys every stack for your stage. See [Environments](/flex/delivery/environments/).          |
| `pnpm dev`                     | Starts the Flex terminal CLI (`@flex/cli`). It is still in development.                                                              |
| `pnpm lint:report`             | Writes ESLint's results for the whole repository to `eslint-report.json`.                                                            |
| `pnpm s3:enforce-tls`          | Reports which S3 buckets lack a policy that refuses plain HTTP. With `--apply`, it adds one.                                         |
| `pnpm dastSetup`               | Used by the ZAP workflow. See [Security scanning](/flex/delivery/security-scanning/).                                                |
| `pnpm semantic:release`        | Used by the main pipeline. See [Releases](/flex/delivery/releases/).                                                                 |

Deploy with `pnpm run deploy`, not `pnpm deploy`. See [Environments](/flex/delivery/environments/).

### Affected packages

`pnpm lint`, `pnpm tsc`, `pnpm test` and `pnpm checkov` use `nx affected`. They run only in the
packages that changed since `main`, including uncommitted changes, and in the packages that depend
on them. CI compares against the last successful run on `main` instead. To run a target in every
package:

```bash
pnpm exec nx run-many --target=test --all --run
```

### One package

Run one package's script with `pnpm --filter <name> <script>`, or run `pnpm <script>` inside the
package's directory:

```bash
pnpm --filter @flex/sdk test --run
pnpm --filter @flex/udp-domain lint
pnpm --filter @platform/flex synth
```

A package's `test` script runs Vitest in watch mode. Add `--run` to run the tests once.

## Getting a token

A public route needs a bearer token in the `Authorization` header. There are two ways to get one.

### `pnpm jwt`

`pnpm jwt` prints a token for a deployed stage. It needs
[AWS credentials](/flex/start/environment-setup/#aws-credentials) for the account the stage lives
in.

```bash
pnpm jwt                  # personal, PR and development stages
STAGE=staging pnpm jwt    # staging
```

What it does depends on `STAGE`, which defaults to `development`:

- For `staging` or `production`, it signs in through GOV.UK One Login as the E2E test user, whose
  details are in the secret `/<stage>/flex-secret/e2e/test_user`, and prints the access token it
  gets back.
- For any other stage, it signs a token with the private key in the secret
  `/development/flex-secret/auth/e2e/private_jwk`. In the development account, the authorizer
  checks tokens against a stub JWKS endpoint that holds the matching public key.

The E2E tests get their tokens the same way. See [E2E tests](/flex/delivery/e2e-tests/).

### `pnpm jwt:playground`

`pnpm jwt:playground` prints a token for a One Login test account of your own. It does not use AWS.
It runs [`scripts/generatePlaygroundToken.ts`](https://github.com/govuk-once/flex/blob/main/scripts/generatePlaygroundToken.ts),
which reads its settings from a `.env` file in the repository root.

1. Copy [`.env.playground.example`](https://github.com/govuk-once/flex/blob/main/.env.playground.example)
   to `.env`. Git ignores `.env`. Never commit it.
2. Fill in `PLAYGROUND_EMAIL`, `PLAYGROUND_PASSWORD` and `PLAYGROUND_TOTP_SEED` with the details
   of your own One Login test account.
3. Fill in the OAuth client settings (`PLAYGROUND_CLIENT_ID`, `PLAYGROUND_AUTH_URL`,
   `PLAYGROUND_TOKEN_URL` and `PLAYGROUND_ONE_LOGIN_ENV`) and `PLAYGROUND_API_URL` with the values
   your Flex contact gives you.
4. Run `pnpm jwt:playground`.

If a value is missing or invalid, the script lists each one and stops. Use the token against the
API URL you were given:

```bash
curl -H "Authorization: Bearer $TOKEN" "$PLAYGROUND_API_URL/<path>"
```

## No build step for libraries

Workspace packages export their TypeScript sources directly, such as `"exports": { ".":
"./src/index.ts" }`, and resolve to each other's sources. Type checks and tests see a change in a
dependency straight away. Lambda code is bundled with esbuild by CDK's `NodejsFunction` when the CDK
app synthesizes. Generated output, such as `dist/` and `cdk.out/`, is ignored by git.

## Adding a shared library

Shared libraries live in `libs/` and are named `@flex/<name>`.

1. Create `libs/<name>/package.json`:

   ```json title="package.json"
   {
     "name": "@flex/<name>",
     "version": "1.0.0",
     "type": "module",
     "private": true,
     "exports": {
       ".": "./src/index.ts"
     },
     "scripts": {
       "tsc": "tsc --noEmit",
       "lint": "eslint --max-warnings=0 .",
       "test": "vitest --passWithNoTests"
     },
     "devDependencies": {
       "@flex/config": "workspace:*"
     }
   }
   ```

   Add `eslint`, `typescript` and `vitest` to `devDependencies` at the versions the other
   libraries use. Add an entry to `exports` for each extra entry point, such as
   `"./cff": "./src/cff.ts"`.

2. Extend the shared configuration from [`@flex/config`](/flex/reference/flex-config/):

   ```js title="eslint.config.mjs"
   import { config } from "@flex/config/eslint";

   export default config;
   ```

   ```json title="tsconfig.json"
   {
     "extends": "@flex/config/tsconfig.json",
     "include": ["src/**/*.ts", "vitest.config.ts"]
   }
   ```

   ```ts title="vitest.config.ts"
   import { config } from "@flex/config/vitest";

   export default config;
   ```

3. Export the library's API from `src/index.ts`.
4. Run `pnpm install` from the root to link the package.
5. Add the package to [Packages](/flex/reference/packages/), and document its API on this site.

## The documentation site

This site lives in `docs/` and is built with Astro and Starlight. Pages are Markdown files in
`docs/src/content/docs/`, and the sidebar is set in `docs/astro.config.mjs`.

```bash
pnpm --filter @flex/docs dev      # serve with live reload
pnpm --filter @flex/docs build    # build to docs/dist/, failing on a broken internal link
```

Internal links include the site's base path, `/flex/`, and end with a slash, such as
`/flex/start/conventions/`. A pull request that changes `docs/` builds the site, and a merge to
`main` publishes it to GitHub Pages at <https://govuk-once.github.io/flex/>. The rules for writing
pages are in [Conventions](/flex/start/conventions/#documentation).
