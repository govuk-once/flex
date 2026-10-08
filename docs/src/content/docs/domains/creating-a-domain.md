---
title: Creating a domain
description: The layout of a domain package, how handler files are named, and the steps to add a domain or a route.
---

A domain is a workspace package under `domains/`. The platform finds it by its `domain.config.ts`,
so adding one needs no change outside its own directory. The quickest start is to copy
`domains/local-council`, the smallest domain, or `domains/example`, which uses every SDK feature.

## Directory layout

```text
domains/<domain>/
├── domain.config.ts          routes, resources, integrations and options
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts          unit tests
├── vitest.e2e.config.ts      module E2E tests, if the domain has them
├── e2e/
│   └── <domain>.test.ts
└── src/
    ├── handlers/
    │   └── <version>/<path>/<method>.ts
    ├── schemas/              Zod schemas for requests and responses
    ├── services/             code shared by several handlers
    ├── tests/
    │   └── fixtures.ts       test data
    └── index.ts              schemas and types other packages may import
```

Unit tests sit next to the handler they test, as `<method>.test.ts` or `<method>.private.test.ts`.

The directory name must match the `name` in `domain.config.ts`. The CDK app builds the path to
each handler from `name`, while the OpenAPI generator names each document after the directory.

## Handler file names

The platform works out the path of each handler file from the route, so there is nothing to
register. The path is `src/handlers/<version>/<path>/<method>.ts`, where:

- each `:param` segment of the path becomes a `[param]` directory
- the method is lower case
- a private route ends `.private.ts`

| Route | File |
| --- | --- |
| `GET /v1/user` (public) | `src/handlers/v1/user/get.ts` |
| `GET /v1/user/:userId` (public) | `src/handlers/v1/user/[userId]/get.ts` |
| `POST /v1/user` (private) | `src/handlers/v1/user/post.private.ts` |
| `PATCH /v1/user/:userId` (private) | `src/handlers/v1/user/[userId]/patch.private.ts` |

A method that is both public and private has two files, one for each. Each file exports its
Lambda handler as `handler`. See [Handlers](/flex/domains/handlers/).

## Package files

The package is named `@flex/<domain>-domain` and exports its configuration as well as its schemas,
so other domains can import types and E2E tests can import the configuration:

```json
{
  "name": "@flex/<domain>-domain",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./config": "./domain.config.ts"
  },
  "scripts": {
    "tsc": "tsc --noEmit",
    "lint": "eslint --max-warnings=0 .",
    "test": "vitest --passWithNoTests",
    "test:e2e": "vitest --passWithNoTests --config vitest.e2e.config.ts"
  }
}
```

It depends on `@flex/sdk`, `@flex/utils`, `zod` and `http-errors`, with `@flex/config` and
`@flex/testing` as dev dependencies, all as `workspace:*` where they are workspace packages. Copy
the exact versions from an existing domain.

`tsconfig.json` extends `@flex/config/tsconfig.json` and maps `@domain` to the configuration, so
handlers import `route` the same way at any depth. Add further aliases as the domain grows:

```json
{
  "extends": "@flex/config/tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@domain": ["./domain.config.ts"],
      "@schemas/*": ["./src/schemas/*"],
      "@services/*": ["./src/services/*"],
      "@tests/fixtures": ["./src/tests/fixtures.ts"]
    }
  },
  "include": ["src/**/*.ts", "e2e/**/*.ts", "vitest.config.ts", "vitest.e2e.config.ts", "domain.config.ts"]
}
```

`eslint.config.mjs` re-exports `@flex/config/eslint`. See
[@flex/config](/flex/reference/flex-config/). The Vitest files are covered in
[Testing](/flex/domains/testing/).

## Adding a domain

1. Create `domains/<domain>/` with the files above, and run `pnpm install` so the workspace picks
   up the new package.
2. Write `domain.config.ts`. Set `environments` to the persistent environments the domain may
   reach. See [Configuration](/flex/domains/configuration/).
3. Declare the resources and integrations the routes need. Any route with an integration also
   needs the private gateway URL resource. See [Resources](/flex/domains/resources/) and
   [Integrations](/flex/domains/integrations/).
4. Write a handler file for each route, and a unit test beside it.
5. Set up `vitest.config.ts` with the SDK setup file and an environment value for each deploy-time
   resource. See [Testing](/flex/domains/testing/#unit-tests).
6. Optionally, add module E2E tests in `e2e/`, a `vitest.e2e.config.ts` and a `test:e2e` script.
   CI runs the E2E tests of every domain that has the script. See
   [Testing](/flex/domains/testing/#module-e2e-tests).
7. Run `pnpm --filter @flex/<domain>-domain test`, `lint` and `tsc`.
8. Deploy to your personal stage and run the E2E tests against it.

## Adding a route to a domain

1. Add the route to `routes` in `domain.config.ts`, under its version, path and method, as
   `public`, `private` or both.
2. List the resources, integrations, feature flags and headers it uses, and its schemas.
3. Create the handler file at the path the route gives, and a test beside it.
4. Run the domain's tests, deploy, and check the route with its E2E tests.

A new route changes the domain's OpenAPI document. Removing or changing an existing route can be a
breaking change, which the pull request check reports. See [OpenAPI](/flex/domains/openapi/).

## How the platform finds a domain

When the CDK app synthesizes, it reads every `domains/*/domain.config.ts` and checks its `config`
export against the SDK's configuration schema. A configuration that fails the check stops the
synth with the file's path. For each domain that has routes to deploy to the stage, it creates a
stack named `<stage>-<name>` holding a Lambda function for each route, its API Gateway methods
and its permissions. A final stack deploys both APIs once every domain stack is in place. See
[Infrastructure](/flex/infrastructure/overview/).

## Deploying one domain

Set `domain` to a domain's `name` and the CDK app leaves out every other domain's stack:

```bash
domain=<domain> pnpm run deploy
```

Deploying, stages and hotswap are described in [Environments](/flex/delivery/environments/).
