---
title: Testing a domain
description: Unit testing domain handlers with the @flex/testing fixtures, and writing module E2E tests that run against a deployed stage.
---

A domain has two kinds of test:

- **Unit tests** call a handler in process, through the whole SDK pipeline, with outbound calls
  stubbed. They sit beside each handler.
- **Module E2E tests** call the domain's routes on a deployed stage. They sit in
  `domains/<domain>/e2e/`.

Both use fixtures from `@flex/testing`. This page shows how to use them for a domain. The full
fixture API is in [@flex/testing](/flex/reference/flex-testing/).

## Unit tests

A handler test runs the same code as a deployed request: the middleware, building the context,
validation, the handler, response validation and error handling. Only the network and AWS are
replaced.

### Vitest configuration

`vitest.config.ts` merges the shared configuration with the domain's own:

```typescript
import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        AWS_REGION: "eu-west-2",
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        encryptionKeyArn: "arn:aws:kms:eu-west-2:123456789012:key/test-key",
        udpNotificationSecret: "test-udp-notification-name", // pragma: allowlist secret
      },
    },
  }),
);
```

- `exclude` keeps the E2E tests out of the unit run.
- `@flex/testing/setup/sdk` blocks real network connections, replaces the secrets and SSM
  middleware, and clears mocks before each test. Add your own setup file after it if the domain
  needs one.
- `env` sets an environment variable for every resource the handlers name, keyed like the
  resource. The SDK reads them when a handler module loads, so a missing one fails the whole test
  file.

The private gateway URL must be `https://execute-api.eu-west-2.amazonaws.com`, the address the
`http` fixture stubs by default.

### Resources in tests

| Type | Where the test value goes |
| --- | --- |
| `kms`, `ssm` | `env` in `vitest.config.ts` |
| `secret` | `sdk.context({ secrets: { key: "value" } })` |
| `ssm:runtime` | `sdk.context({ params: { key: "value" } })` |

`secret` and `ssm:runtime` resources also need an `env` entry, since the deployed variable holds
their name. Their values come from the Lambda context, because the setup file replaces the
middleware that would fetch them.

### Writing a handler test

Import `it` from `@flex/testing`. Its `sdk` fixture builds the event and Lambda context, and its
`http` fixture stubs calls to the private API:

```typescript
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/notifications", () => {
  const endpoint = "/notifications";
  const userId = "test-user-id";

  it("returns 200 with the user's notifications", async ({ http, sdk }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId: "test-push-id" });
    http
      .gateway("uns")
      .get("/notifications", { query: { externalUserID: "test-push-id" } })
      .reply(200, []);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context({ secrets: { udpNotificationSecret: "test-secret" } }), // pragma: allowlist secret
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([]);
  });
});
```

Name the test after the handler: `get.test.ts` beside `get.ts`, and `get.private.test.ts` beside
`get.private.ts`.

### Building the event

`sdk.event.get`, `post`, `put`, `patch` and `delete` take a path and options:

| Option | Sets |
| --- | --- |
| `auth` | The pairwise id the authorizer would pass. `false` removes it, to test the `401`. |
| `headers` | Request headers. `Content-Type: application/json` is always set. |
| `params` | Path parameters. The path string is not parsed, so pass them here. |
| `query` | Query string parameters |
| `body` | The request body, which the fixture serialises |

Without `auth`, the event carries the pairwise id `test-user-id`.

### Stubbing integrations

`http.domain(target)` and `http.gateway(target)` stub requests to `/domains/<target>/v1` and
`/gateways/<target>/v1` on the private API. Pass a second argument for another version. Each
method takes the rest of the path and can match `headers`, `query` and `body`, then `.reply(status,
body)` sets the response.

Every stub must be used. A test that leaves one unused fails, and a request with no stub fails
because real connections are blocked.

### Running unit tests

```bash
pnpm --filter @flex/<domain>-domain test              # run once
pnpm --filter @flex/<domain>-domain test --watch      # rerun on change
pnpm --filter @flex/<domain>-domain test --coverage   # with a coverage report
```

## Module E2E tests

Module E2E tests call a deployed stage through CloudFront, as the app does. A domain opts in with
three things:

1. tests in `e2e/`, named `*.test.ts`
2. a `vitest.e2e.config.ts` that uses the shared E2E configuration
3. a `test:e2e` script: `vitest --passWithNoTests --config vitest.e2e.config.ts`

```typescript
// vitest.e2e.config.ts
import { e2eConfig } from "@flex/config/vitest/e2e";

export default e2eConfig;
```

A domain whose calls are slow can merge a longer `testTimeout` over `e2eConfig`, as the example
domain does.

### Writing an E2E test

Import `it` from `@flex/testing/e2e`. Its fixtures include `cloudfront`, a client for the stage's
public API that adds `/app` to every path, and `authHeader`, the headers a signed-in request needs.
Wrap the suite in `isDomainDeployed`, and each route in `isRouteDeployed`, so the tests skip what
the stage does not deploy:

```typescript
import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

import { config } from "../domain.config";

describe.runIf(isDomainDeployed(config))("Topics domain", () => {
  describe.runIf(isRouteDeployed(config, "GET /v1/topics"))("GET /topics/v1/topics", () => {
    const endpoint = "/topics/v1/topics";

    it("rejects a request without a token", async ({ cloudfront }) => {
      const result = await cloudfront.client.get(endpoint);

      expect(result.status).toBe(401);
    });

    it("returns 200 with the user's topics", async ({ cloudfront, authHeader }) => {
      const result = await cloudfront.client.get(endpoint, { headers: authHeader });

      expect(result.status).toBe(200);
    });
  });
});
```

When a test depends on another domain's route, check that route too, with the other domain's
configuration from `@flex/<domain>-domain/config`.

### Running E2E tests

E2E tests need AWS credentials for the stage's account. See
[AWS credentials](/flex/start/environment-setup/#aws-credentials).

```bash
pnpm --filter @flex/<domain>-domain test:e2e                        # your personal stage
STAGE=development pnpm --filter @flex/<domain>-domain test:e2e      # another stage
```

CI finds every domain whose `package.json` has a `test:e2e` script and runs each as its own
`Module E2E` check. How the platform E2E suite and module E2E tests run in the pipeline is in
[E2E tests](/flex/delivery/e2e-tests/).
