# @flex/testing

Test utilities, fixtures and extended test functions for FLEX.

This package provides two entry points:

- `@flex/testing`: Vitest fixtures for unit/integration testing
- `@flex/testing/e2e`: Vitest fixtures for E2E testing against deployed infrastructure

---

## Commands

Run these from the repository root:

| Command                            | Description    |
| ---------------------------------- | -------------- |
| `pnpm --filter @flex/testing lint` | Lint files     |
| `pnpm --filter @flex/testing tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `libs/testing/`.

## API

### `it`

| Name | Description                                 | Code                       |
| ---- | ------------------------------------------- | -------------------------- |
| `it` | Extended Vitest test function with fixtures | [View](./src/extend/it.ts) |

### Fixtures

| Name                                                                                           | Description                                              | Code                             |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------- |
| [`createFixtureBuilder`](#createfixturebuilder)                                                | Factory for a fixture builder function                   | [View](./src/utils/fixtures.ts)  |
| [`createFixtureVariants`](#createfixturevariants)                                              | Factory for a fixture builder with named variant methods | [View](./src/utils/fixtures.ts)  |
| [`mergeFixture`](#mergefixture)                                                                | Deep-merges a base fixture value with overrides          | [View](./src/utils/fixtures.ts)  |
| `buildLambdaContext`                                                                           | Lambda context builder                                   | [View](./src/fixtures/lambda.ts) |
| `createUserId`                                                                                 | Branded `UserId` fixture factory                         | [View](./src/fixtures/user.ts)   |
| `createTimestamp`, `createUuid`, `createToken`                                                 | Primitive fixture factories                              | [View](./src/fixtures/common.ts) |
| `validJwt`, `invalidJwt`, `expiredJwt`, `jwtMissingUsername`, `validJwtUsername`, `publicJWKS` | Static JWT test data and JWKS                            | [View](./src/fixtures/auth.ts)   |

---

## `it`

Extended Vitest test function that provides fixtures for unit testing Lambda handlers.

### Usage

```typescript
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./handler";

describe("GET /example", () => {
  it("returns 200", async ({ sdk }) => {
    const result = await handler(sdk.event.get("/example"), sdk.context());

    expect(result.statusCode).toBe(200);
  });
});
```

### Fixtures

| Fixture    | Description                                                                                                                                    | Auto |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `env`      | Stubs environment variables with automatic unstubbing during teardown                                                                          | Yes  |
| `http`     | Intercepts outbound HTTP calls and throws errors during teardown for any unused interceptors registered for a test run. Built on top of `nock` | Yes  |
| `sdk`      | Builds domain handler events and Lambda context                                                                                                | -    |
| `platform` | Builds platform handler events (service gateways, token authorizer and CloudFront Functions) and Lambda context                                | -    |

`http` and `env` are automatic fixtures (see [Vitest Automatic Fixtures](https://vitest.dev/guide/test-context.html#automatic-fixture)) and are active for all tests. Use `sdk` for domain handler tests and `platform` for platform domain handlers and service gateways, see [Platform Development Guide: Testing](/docs/platform-development.md#testing).

---

## `sdk`

Builds requests and context for testing domain handlers built with [`@flex/sdk`](/libs/sdk/README.md).

### `sdk.event`

Exposes HTTP methods (`get`, `post`, `put`, `patch`, `delete`), each taking a path and options:

| Option    | Description                                                                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`    | A `UserId` to simulate an authenticated request, assigned to `auth.pairwiseId` on the handler context. Pass `false` to explicitly omit the authorizer context to simulate unauthenticated requests |
| `headers` | Request headers                                                                                                                                                                                    |
| `params`  | Path parameters                                                                                                                                                                                    |
| `query`   | Query string parameters                                                                                                                                                                            |
| `body`    | Request body (Only included for write operations)                                                                                                                                                  |

```typescript
import { it } from "@flex/testing";

it("example", async ({ sdk }) => {
  const event = sdk.event.get("/users", {
    auth: "test-user-id",
    query: { page: 1 },
  });
});
```

### `sdk.context`

Builds the Lambda context and provides fields for declaring `secrets`/`params` resources to be resolved by middleware. Also includes `userId` for providing a custom ID in the Lambda context:

```typescript
sdk.context({
  secrets: { mySecret: "test-secret-value" }, // pragma: allowlist secret
  params: { myParam: "test-param-value" },
  userId: createUserId("custom-user-id"),
});
```

See [Domain Development Guide: Testing](/docs/domain-development.md#testing) for usage examples.

---

## `platform`

Builds events, results and context for testing platform domain handlers and service gateways. See [Platform Development Guide: Testing](/docs/platform-development.md#testing) for usage examples of each fixture.

| Fixture            | Use                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------ |
| `gatewayEvent`     | `get`/`post`/`put`/`patch`/`delete` builders for a service gateway route event       |
| `gatewayResult`    | `(statusCode, options?)` builder for a gateway proxy result                          |
| `authorizerEvent`  | Builder for a Lambda token authorizer event                                          |
| `authorizerResult` | `(effect, resource, options?)` builder for an IAM authorizer policy result           |
| `cloudFrontEvent`  | `get`/`post`/`put`/`patch`/`delete` builders for a CloudFront Function Request event |
| `cloudFrontResult` | `(statusCode, options?)` builder for a CloudFront Function response                  |
| `context`          | Base Lambda context builder                                                          |
| `dynamo`           | Stubs the DynamoDB reads a gateway's clients make                                    |
| `secret`           | Stubs the Secrets Manager reads a gateway's resources make                           |

> `gatewayEvent` reads `FLEX_GATEWAY_NAME` from the environment to build the correct gateway path prefix `/gateways/<name>` and will throw if its not provided. This must be set in the workspace's `vitest.config.ts` under `env`.

### `dynamo`

Backed by [`aws-sdk-client-mock`](https://github.com/m-radzikowski/aws-sdk-client-mock)
over the `@aws-sdk/lib-dynamodb` document client. The mock is installed the
first time a test uses it, reset between tests and restored when the file
finishes, so a suite that stubs DynamoDB over HTTP is left alone.

| Helper          | Description                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------- |
| `scan.resolves` | One argument per page; later pages are only reached if the handler follows `LastEvaluatedKey` |
| `scan.rejects`  | Fails the read, as an unreachable table or denied role does                                   |
| `scan.calls`    | Every Scan the handler sent, in order                                                         |
| `scan.input`    | The nth Scan the handler sent, defaulting to the first                                        |
| `scan.cursor`   | The key `resolves` hands back at the end of the given page                                    |
| `client`        | The underlying client mock, for commands the helpers do not cover                             |

```typescript
it("follows pagination", async ({ platform }) => {
  platform.dynamo.scan.resolves([firstRow], [secondRow]);

  await handler(platform.gatewayEvent.get("/v1/example"), platform.context());

  expect(platform.dynamo.scan.calls()).toHaveLength(2);
  expect(platform.dynamo.scan.input(1)).toMatchObject({
    ExclusiveStartKey: platform.dynamo.scan.cursor(),
  });
});
```

### `secret`

Stubs Secrets Manager for the gateway's `secret` resources, which are read
through Powertools. `resolves` and `rejects` return the ARN of the secret they
stubbed, which is the value the resource's environment variable holds.

| Helper     | Description                                               |
| ---------- | --------------------------------------------------------- |
| `resolves` | Stubs the secret and returns its ARN                      |
| `rejects`  | Fails the read, as a missing secret or denied policy does |
| `arn`      | ARN the named secret would have, without stubbing it      |
| `calls`    | Every secret read the handler issued, in order            |

---

## `http`

Intercepts outbound HTTP calls made during a test, built on top of [`nock`](https://github.com/nock/nock).

| Method                                 | Prefix                              |
| -------------------------------------- | ----------------------------------- |
| `http.gateway(target, version = "v1")` | `/gateways/<target>/<version>`      |
| `http.domain(target, version = "v1")`  | `/domains/<target>/<version>`       |
| `http.url(baseUrl)`                    | Matches the given base URL directly |

All three return the same interceptor API of common HTTP methods (`get`, `post`, `put`, `patch`, `delete`), each accepting a path and options (`headers`/`query`/`body`), chained using nock's `reply` pattern: `.reply(status, body?)`:

```typescript
http
  .gateway("udp")
  .get("/identity/dvla", { headers: { "User-Id": userId } })
  .reply(200, serviceIdentityLink);

http
  .url("https://secretsmanager.eu-west-2.amazonaws.com")
  .post("/")
  .reply(200, secretValue);
```

The default base URL (used by `gateway`/`domain`) is the private API Gateway's execute-api URL. `http` is an automatic fixture so any interceptor that is registered but never called will fail a test during teardown.

---

## `env`

Stubs environment variables for a test and automatically unstubs afterwards. This is also an automatic fixture so it's enabled for all tests.

---

## `createFixtureBuilder`

Wraps a base fixture shape and deep merges overrides on top if it to create a new instance:

```typescript
import { createFixtureBuilder } from "@flex/testing";

export const createSession = createFixtureBuilder({
  "id-token": "test-token",
  // ...defaults
});
export const session = createSession();

createSession({ "id-token": "custom-id-token" });
```

---

## `createFixtureVariants`

Extends `createFixtureBuilder` capabilities by attaching named variants with access to the base builder for more complex test data needs:

```typescript
import { createFixtureVariants } from "@flex/testing";

export const createEvent = () =>
  createFixtureVariants(baseEvent, (build) => ({
    get: (path: string) => build({ httpMethod: "GET", path }),
    post: (path: string, body: unknown) =>
      build({ httpMethod: "POST", path, body: JSON.stringify(body) }),
  }));

const event = createEvent();
event.get("/users");
event.post("/users", { name: "Jane" });
event({ httpMethod: "PUT" }); // the base builder is still callable directly
```

This is the pattern behind `sdk.event`, `platform.gatewayEvent` and `platform.cloudFrontEvent`.

---

## `mergeFixture`

Deep-merges overrides into a base fixture shape and is used internally by `createFixtureBuilder`. Only reach for this utility directly when neither of the fixture utility functions give you what you need, but the preference is to opt for either `createFixture*` function to create test data and mocks.

---

## `@flex/testing/e2e`

| Name                                                    | Description                                                                | Code                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| [`it`](#it-e2e)                                         | Extended test function with E2E fixtures                                   | [View](./src/e2e/it.ts)                      |
| [`extendIt`](#extendit)                                 | Base extend function the shared E2E fixtures build on                      | [View](./src/extend/it.e2e.ts)               |
| [`createApi`](#createapi)                               | HTTP client factory for E2E tests                                          | [View](./src/fixtures/api.ts)                |
| [`e2eEnvSchema`](#e2eenvschema)                         | Zod schema for E2E environment variables                                   | [View](./src/config/env.ts)                  |
| `getStubTokenGenerator`, `getStubTokenGeneratorFromJWK` | Stub JWT generators for local/dev E2E runs, signing tokens from a stub key | [View](./src/fixtures/StubTokenGenerator.ts) |
| `getTokenGenerator`, `createTokenGeneratorFromConfig`   | Real Cognito token generator for staging/production                        | [View](./src/fixtures/TokenGenerator.ts)     |

---

## `it` (E2E)

Extended Vitest test function for end-to-end tests against deployed infrastructure.

### Usage

```typescript
import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("GET /hello", () => {
  const { JWT } = inject("e2eEnv");

  it("rejects unauthenticated requests", async ({ cloudfront }) => {
    const result = await cloudfront.client.get("/hello");

    expect(result.status).toBe(401);
  });

  it("returns 200 for an authenticated request", async ({
    cloudfront,
    authHeader,
  }) => {
    const result = await cloudfront.client.get("/hello", {
      headers: authHeader,
    });

    expect(result.status).toBe(200);
  });
});
```

### Fixtures

| Fixture          | Description                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `cloudfront`     | HTTP client scoped to `<FLEX_API_URL>/app`                                                                                    |
| `privateGateway` | HTTP client scoped to `FLEX_PRIVATE_GATEWAY_URL`                                                                              |
| `docs`           | HTTP client scoped to the raw `FLEX_API_URL`                                                                                  |
| `authHeader`     | `{ Authorization: "Bearer <JWT.VALID>", "x-flex-e2e-bypass": <E2E_BYPASS_TOKEN> }` header object for an authenticated request |

`extendIt()` builds these; domains can layer their own fixtures on top, as `@flex/testing/e2e`'s `it` does for UDP (`udpUser`, `withCleanIdentity`, `withIdentityLink`), see [`e2e/it.ts`](./src/e2e/it.ts).

Tokens and URLs are injected once per run via `inject("e2eEnv")`:

| Value                       | Description                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `FLEX_API_URL`              | Base URL of the deployed API                                                          |
| `FLEX_PRIVATE_GATEWAY_URL`  | Base URL of the deployed private gateway                                              |
| `JWT.VALID` / `JWT.INVALID` | Authentication token variants (valid, invalid)                                        |
| `E2E_BYPASS_TOKEN`          | Secret token for the `x-flex-e2e-bypass` header, bypassing WAF IP reputation blocking |
| `STAGE`                     | Resolved stage name                                                                   |

---

## `createApi`

Factory for creating HTTP clients for E2E tests.

### Usage

```typescript
import { createApi } from "@flex/testing/e2e";

const api = createApi("https://api.example.com");

const users = await api.client.get("/users");
```

---

## `e2eEnvSchema`

Zod schema for validating E2E environment variables.

---

## Related

**FLEX:**

- [@flex/utils](/libs/utils/README.md)
- [@flex/sdk](/libs/sdk/README.md)
- [@flex/service-gateway](/libs/service-gateway/README.md)

**Guides:**

- [Domain Development Guide: Testing](/docs/domain-development.md#testing)
- [Platform Development Guide: Testing](/docs/platform-development.md#testing)

**External:**

- [Vitest Test Context](https://vitest.dev/guide/test-context)
- [nock](https://github.com/nock/nock)
