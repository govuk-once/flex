---
title: Testing
description: Unit and end-to-end testing for domains.
sidebar:
  order: 7
---

A domain has two kinds of test:

| Kind     | Runs                                           | Needs AWS access | Lives in                                                              |
| -------- | ---------------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| **Unit** | In process, with outbound calls stubbed        | No               | Next to the handler: `<method>.test.ts` or `<method>.private.test.ts` |
| **E2E**  | Over HTTP against your deployed personal stack | Yes              | `domains/<name>/e2e/`                                                 |

Both use [`@flex/testing`](https://github.com/govuk-once/flex/tree/main/libs/testing) and [Vitest](https://vitest.dev/). The package README is the reference for every fixture. This page covers how a domain uses them.

## Unit tests

A unit test calls the handler directly with a fake API Gateway event and Lambda context. It runs the whole SDK pipeline: validation, context building, your code and response mapping. Only the network is faked.

### Fixtures

Import `it` from `@flex/testing`. It gives each test these fixtures:

| Fixture | Use                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| `sdk`   | Builds the request event and the Lambda context. See [Build the request](#build-the-request).                      |
| `http`  | Stubs outbound calls to gateways and other domains. See [Stub outbound calls](#stub-outbound-calls).               |
| `env`   | Sets environment variables for one test, and puts them back afterwards. `http` and `env` are active in every test. |

Platform code, such as service gateways and authorizers, uses a different fixture, `platform`. See [Platform testing](/flex/platform/testing/).

### Set up the domain

Each domain has a `vitest.config.ts` that extends the [shared Flex config](https://github.com/govuk-once/flex/blob/main/libs/config/src/vitest.ts):

```ts title="vitest.config.ts"
import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: [
        "@flex/testing/setup/sdk",
        // Your own setup file, if you need one
        // "./src/tests/setup.ts",
      ],
      env: {
        // One entry per deploy-time resource the domain declares
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
      },
    },
  }),
);
```

| Setting      | Purpose                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exclude`    | Keeps `e2e/` out of the unit run. E2E tests have their own config.                                                                                                                                              |
| `setupFiles` | Runs before the tests. `@flex/testing/setup/sdk` stubs the Secrets Manager and SSM middleware and switches off network access. Add your own file to the array for any setup or teardown specific to the domain. |
| `env`        | Environment variables for every test. Add a [resource](#resources) here for each deploy-time resource.                                                                                                          |

#### AWS credentials and region

Unit tests don't need an AWS login or an assumed role. The [shared Flex config](https://github.com/govuk-once/flex/blob/main/libs/config/src/vitest.ts) sets these environment variables for every test. This applies even if your shell has real, expired or stale AWS variables, so you don't need to repeat them in a domain's `env`.

| Variable                | Value       | Purpose                                                                          |
| ----------------------- | ----------- | -------------------------------------------------------------------------------- |
| `AWS_REGION`            | `eu-west-2` | The region SDK clients use and ARNs are built with.                              |
| `AWS_ACCESS_KEY_ID`     | `test`      | A dummy key, so request signing never looks for real credentials.                |
| `AWS_SECRET_ACCESS_KEY` | `test`      | A dummy secret, for the same reason.                                             |
| `AWS_PROFILE`           | blank       | Clears any profile from your shell, which the SDK would use instead of the keys. |

To use a different value in one domain, set that variable under `env`. It is merged over the shared default:

```ts
env: {
  AWS_REGION: "eu-west-1",
},
```

Used in: [`libs/config/src/vitest.ts`](https://github.com/govuk-once/flex/blob/main/libs/config/src/vitest.ts)

See the [`@flex/testing` README](https://github.com/govuk-once/flex/blob/main/libs/testing/README.md#aws-credentials-in-unit-tests) for every variable and an override example for each.

### Write a test

A unit test builds a request, calls the handler and checks the result. This is the skeleton, for a handler that makes no outbound calls:

```ts title="src/handlers/v1/items/get.test.ts" ins={"1":9} ins={"2":11-12} ins={"3":15}
import { createUserId, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

const userId = createUserId("test-user");

describe("GET /v1/items", () => {
  it("returns 200", async ({ sdk }) => {
    const result = await handler(
      sdk.event.get("/items", { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
  });
});
```

| Key | Purpose                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------- |
| `1` | Ask for the fixtures the test needs. `sdk` builds the request.                                                  |
| `2` | The API Gateway event and the Lambda context the handler receives. See [Build the request](#build-the-request). |
| `3` | The handler returns an API Gateway result, so assert on `statusCode` and parse `body`.                          |

Write a test for each status the handler can return, including the error paths. That catches most mistakes.

### Build the request

`sdk.event` has a builder for each method: `get`, `post`, `put`, `patch` and `delete`. Each takes a path and these options:

| Option    | Description                                                                                |
| --------- | ------------------------------------------------------------------------------------------ |
| `auth`    | A user id, which becomes `auth.userId` in the handler. Pass `false` to leave the user out. |
| `headers` | Request headers.                                                                           |
| `params`  | Path parameters.                                                                           |
| `query`   | Query parameters.                                                                          |
| `body`    | Request body. Write methods only.                                                          |

A private route has no `auth`, so send the user id in the header the route declares:

```ts
sdk.event.get("/items", {
  headers: { "requesting-service-user-id": userId },
});
```

`sdk.context()` builds the Lambda context. For routes that use runtime resources, pass their values to it. See [Run-time resources](#run-time-resources).

### Stub outbound calls

A handler never calls another service directly. It goes through an integration, and `http` stubs the request that integration makes. Add it to the skeleton for a handler that calls a gateway:

```ts title="src/handlers/v1/items/get.test.ts" ins={"1":1} ins={"2":2-3} ins={"3":4} ins={"4":5}
it("returns 200 with the items", async ({ http, sdk }) => {
  http
    .gateway("udp")
    .get("/items", { headers: { "requesting-service-user-id": userId } })
    .reply(200, { items: [] });

  const result = await handler(
    sdk.event.get("/items", { auth: userId }),
    sdk.context(),
  );

  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body)).toStrictEqual({ items: [] });
});
```

| Key | Purpose                                                                                       |
| --- | --------------------------------------------------------------------------------------------- |
| `1` | Ask for `http` as well as `sdk`.                                                              |
| `2` | Which service the handler calls. Everything the stub matches is under this gateway or domain. |
| `3` | The request the handler is expected to make: method, path and any headers, query or body.     |
| `4` | The response the handler gets back.                                                           |

The methods you can stub are:

| Method                | Stubs calls to                                        |
| --------------------- | ----------------------------------------------------- |
| `http.gateway("udp")` | A service gateway: `/gateways/udp/v1/...`             |
| `http.domain("udp")`  | Another domain's private route: `/domains/udp/v1/...` |
| `http.url(baseUrl)`   | Any other URL                                         |

Each has `get`, `post`, `put`, `patch` and `delete`, which take a path and optional `headers`, `query` and `body` to match. Then `.reply(status, body)` gives the stubbed response.

- **Match the call you expect.** The `headers`, `query` and `body` you give are compared with the request the handler sends. If the handler leaves out `requesting-service-user-id`, or sends a different value, the stub doesn't match and the call fails. So a stub like the one above also tests that the handler passes the user id on.
- **Unused stubs fail the test.** If a stub is never called, the test fails when it ends. This catches a handler that stops making a call.
- **Unstubbed calls fail.** Network access is switched off in unit tests. The integration throws a network error, and if the handler doesn't catch it, the SDK returns a `500` with no body and logs `Unhandled error`.
- **Use the right version.** The version defaults to `v1`. Pass another as the second argument, such as `http.gateway("udp", "v2")`.

The stubs match the private gateway URL of the domain's [`privateGatewayUrl` resource](/flex/domains/domain-config/#the-private-gateway-url). See [Deploy-time resources](#deploy-time-resources).

### Test failure paths

Stub the failures an upstream service can return, and check how the handler [handles them](/flex/domains/calling-other-domains/#handle-upstream-errors):

```ts
it("returns 502 when the gateway fails", async ({ http, sdk }) => {
  http
    .gateway("udp")
    .get("/items", { headers: { "requesting-service-user-id": userId } })
    .reply(500, {});

  const result = await handler(
    sdk.event.get("/items", { auth: userId }),
    sdk.context(),
  );

  expect(result.statusCode).toBe(502);
});
```

Try a `404`, a `500` and a response that doesn't match the integration's `response` schema (the handler sees a `422`).

### Resources

The resources a route lists are available in unit tests in two ways, depending on when they resolve:

| Resource type               | Resolved    | Set it in                                                         |
| --------------------------- | ----------- | ----------------------------------------------------------------- |
| `"kms"`, `"ssm"`            | Deploy time | `env` in the domain's `vitest.config.ts`                          |
| `"secret"`, `"ssm:runtime"` | Run time    | `env` (a placeholder name), and the test, through `sdk.context()` |

#### Deploy-time resources

These are read when the handler module loads, so they must be in `env` in `vitest.config.ts` before any test runs. Add one entry per resource, named after its key, and always include the private gateway URL. The `http` stubs match `https://execute-api.eu-west-2.amazonaws.com`, so use that value for the private gateway URL.

#### Run-time resources

In a deployed Lambda, middleware fetches these before the handler runs. The handler module still checks, when it loads, that an environment variable named after each resource exists, and throws if not. So add an entry for each one to `env` in `vitest.config.ts` too, with any placeholder such as the resource name. The real value comes from the context. In a test, hand their values to the context:

```ts
const result = await handler(
  sdk.event.get("/items", { auth: userId }),
  sdk.context({
    secrets: { apiKey: "test-secret-value" }, // pragma: allowlist secret
    params: { itemLimit: "10" },
  }),
);
```

### Feature flags and environment variables

Use the `env` fixture to set an environment variable for one test. It is put back afterwards, so tests don't affect each other:

```ts
it("includes metadata when the flag is on", async ({ env, sdk }) => {
  env.set({ enableItemMetadata: "true" });
  // ...
});
```

This is how you test both values of a feature flag. See [Feature flags](/flex/domains/feature-flags/#testing-a-flag).

### Code that uses `routeContext`

Helpers and services that read [`routeContext`](/flex/domains/route-context/) only work during a handler call. Test them through the handler that calls them. Calling one directly throws, because there is no route in flight. Helpers that take their values as arguments can be tested on their own.

## End-to-end tests

An E2E test sends real HTTP requests to your deployed stack, through CloudFront, the authorizer and the Lambda. Use it to check what unit tests can't: the deployed config, permissions and the live gateways.

:::note
E2E tests need AWS access and a deployed personal stack. See [Your first domain](/flex/getting-started/your-first-domain/#7-run-the-e2e-test) to deploy and run one. If they fail with `unable to get local issuer certificate`, see [Troubleshooting](/flex/getting-started/troubleshooting/#unable-to-get-local-issuer-certificate).
:::

### Set up the domain

E2E tests have their own config, `vitest.e2e.config.ts`, and a `test:e2e` script that uses it:

```ts title="vitest.e2e.config.ts"
import { e2eConfig } from "@flex/config/vitest/e2e";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  e2eConfig,
  defineConfig({
    test: {
      testTimeout: 40_000,
    },
  }),
);
```

```json title="package.json"
"scripts": {
  "test": "vitest --passWithNoTests",
  "test:e2e": "vitest --passWithNoTests --config vitest.e2e.config.ts"
}
```

CI finds domains to test by looking for a `test:e2e` script. Used in: [`domains/topics`](https://github.com/govuk-once/flex/blob/main/domains/topics/vitest.e2e.config.ts).

### Write a test

Import `it` from `@flex/testing/e2e`, and wrap the tests in `describe.runIf(isDomainDeployed(config))`. That skips them when the domain doesn't deploy to the stage you're testing:

```ts title="e2e/items.test.ts"
import { isDomainDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

import { config } from "../domain.config";

describe.runIf(isDomainDeployed(config))("Items domain", () => {
  it("rejects unauthenticated requests", async ({ cloudfront }) => {
    const result = await cloudfront.client.get("/items/v1/items");

    expect(result.status).toBe(401);
  });

  it("returns 200 for an authenticated user", async ({
    cloudfront,
    authHeader,
  }) => {
    const result = await cloudfront.client.get("/items/v1/items", {
      headers: authHeader,
    });

    expect(result.status).toBe(200);
  });
});
```

Used in: [`domains/topics/e2e`](https://github.com/govuk-once/flex/blob/main/domains/topics/e2e/topics.test.ts).

### E2E fixtures

| Fixture          | Description                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `cloudfront`     | An HTTP client for public routes. Paths start at `/app`, so write `/<domain>/<version>/<path>`.      |
| `authHeader`     | Headers for an authenticated request: a valid token and the [bypass header](#the-e2e-bypass-header). |
| `privateGateway` | An HTTP client for the private API Gateway.                                                          |
| `docs`           | An HTTP client for the API's root URL.                                                               |

#### Private routes

Public routes are covered through `cloudfront`. Private routes are harder to reach from a test:

- The private API Gateway is only reachable through a VPC endpoint (see [How Flex works](/flex/introduction/how-flex-works/#inbound-public-and-private-routes)), so a request from outside the VPC, such as from your machine, can't normally get to it.
- Its routes use IAM authorisation, so a request has to be signed with SigV4. The `privateGateway` client is a plain HTTP client and doesn't sign requests.
- No domain's E2E tests use `privateGateway` today.

Cover a private route in two ways instead. Test its handler with unit tests, and, if a public route calls it through an integration, the public route's E2E test exercises the private route as part of the request.

### Tokens

The setup fetches its own tokens, so you don't export one. It uses a stub token in `development`, personal and `pr-<n>` stages, and a real Cognito token in `staging` and `production`. The stub token is the same kind `pnpm jwt` prints. See [Environment setup](/flex/getting-started/environment-setup/).

### The E2E bypass header

`authHeader` includes `x-flex-e2e-bypass`. The edge WAF lets a request that carries it past two of its rules:

- the AWS IP reputation list,
- the per-IP rate limit.

It does **not** skip the other AWS managed rules, such as the SQL injection and known-bad-inputs rules, so a test request is still checked by them.

The header carries a secret. The WAF compares it with a value in Secrets Manager (`/<stage>/flex-secret/waf/e2e-bypass`), and the E2E setup reads that value for you. So:

- Always use `authHeader`. Never copy the value into a test, a script or a log.
- Real clients never send it. It exists for tests only.

See [How Flex works](/flex/introduction/how-flex-works/#1-edge) for the rest of the edge.

### Run against another stage

By default, E2E tests target your personal stack. Set `STAGE` to target another stage:

```bash
STAGE=development pnpm --filter @flex/<name>-domain test:e2e
```

CI runs the `test:e2e` script of every domain that has one, against each pull request's environment and after each deploy to `development` and `staging`. It isn't a required check and doesn't block promotion, so look at the result yourself. See [CI/CD](/flex/delivery/ci-cd/).

## Run the tests

```bash
# Unit tests (watch mode when run in a terminal)
pnpm --filter @flex/<name>-domain test

# Unit tests with coverage
pnpm --filter @flex/<name>-domain test --coverage

# E2E tests against your personal stack
pnpm --filter @flex/<name>-domain test:e2e

# Typecheck and lint
pnpm --filter @flex/<name>-domain tsc
pnpm --filter @flex/<name>-domain lint
```
