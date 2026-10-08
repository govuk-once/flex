---
title: "@flex/testing"
description: The Vitest fixtures, setup files, builders, test data and E2E harness in @flex/testing.
---

`@flex/testing` lives in `libs/testing`. It extends Vitest's `it` with fixtures for unit testing
domain handlers, service gateways and platform handlers, and provides the harness the E2E suites
run on. This page is the reference for its API. For how to test each kind of code, see
[Testing domains](/flex/domains/testing/), [Testing gateways](/flex/gateways/testing/),
[Platform handlers](/flex/edge/platform-handlers/) and [E2E tests](/flex/delivery/e2e-tests/).

Packages add it as a `workspace:*` dev dependency. Its own scripts are `lint`, `tsc` and `test`.

## Entry points

| Import | Use |
| --- | --- |
| `@flex/testing` | Unit tests: [`it`](#it) and its fixtures, [builders](#builders) and [test data](#test-data). |
| `@flex/testing/setup/sdk` | [Setup file](#setupsdk) for domain unit tests. |
| `@flex/testing/setup/platform` | [Setup file](#setupplatform) for service gateway and platform handler unit tests. |
| `@flex/testing/e2e` | E2E tests: the E2E [`it`](#it-e2e), [`extendIt`](#extendit), [`createApi`](#createapi), [`e2eEnvSchema`](#injected-environment) and the [token generators](#token-generators). |
| `@flex/testing/e2e/setup` | The E2E [global setup](#global-setup). |
| `@flex/testing/auth` | The [token generators](#token-generators) alone, for scripts that are not tests. |

## Setup files

A package's `vitest.config.ts` loads one setup file through `setupFiles` (see
[Vitest](/flex/reference/flex-config/#vitest)). Both setup files block real network connections for
the whole test file, so any outbound request that no [`http`](#http) interceptor matches fails.
Both clear every `vi.fn()` mock's calls before each test.

### setup/sdk

For domains built with `@flex/sdk`. It also:

- Replaces `createSigv4Fetcher`, `createSigv4FetchWithCredentials`, `flexFetch` and `typedFetch`
  with `vi.fn()` for code that imports them from `@flex/sdk`. Integrations declared on a route
  still send their requests, and [`http`](#http) intercepts them.
- Replaces the `@middy/secrets-manager` and `@middy/ssm` middleware with middleware that fetches
  nothing. A route's `secret` and `ssm:runtime` resources are supplied through
  [`sdk.context`](#sdkcontext) instead.

### setup/platform

For service gateways and platform handlers. It also:

- Before each test, clears the Powertools parameters cache and resets every AWS client mock that
  the [`dynamodb`](#dynamodb) and [`secret`](#secret) fixtures installed, dropping their stubs and
  recorded calls. After the file, it puts the real AWS clients back.
- Replaces `createSigv4FetchWithCredentials` from `@flex/sdk` with an unsigned `fetch` to the same
  URL, so a gateway client that signs its requests needs no AWS role, and [`http`](#http) can
  intercept the request.

Without `setup/platform`, `dynamodb` and `secret` stubs carry over from one test to the next.

## it

```typescript
import { it } from "@flex/testing";
```

`it` is Vitest's `it`, extended with the fixtures below. Name a fixture in the test's first argument
to use it. `env` and `http` are automatic: they run for every test whether it names them or not.

| Fixture | Automatic | Holds |
| --- | --- | --- |
| [`env`](#env) | Yes | Environment variable stubs, undone after the test. |
| [`http`](#http) | Yes | Outbound HTTP interceptors, checked after the test. |
| [`sdk`](#sdk) | No | Event, context and result builders for domain handlers. |
| [`platform`](#platform) | No | Event, context and result builders for service gateways and platform handlers, with [`dynamodb`](#dynamodb) and [`secret`](#secret) stubs. |

Fixtures work in hooks too: `it.beforeEach(({ env, platform }) => { … })`.

To type a helper that takes a fixture, use the exported types: `HttpFixture`, `PlatformFixture`,
`SecretFixture`, `DynamoDBFixture` and its per-command types such as `DynamoDBGetFixture`, and
`DocumentClientMock`. `DynamoDBItem` and `DynamoDBPage` type the items and pages given to
`dynamodb`.

## env

| Method | Does |
| --- | --- |
| `env.set(values)` | Sets each variable with `vi.stubEnv`. A value that is `undefined` or empty deletes the variable instead. |
| `env.delete(...names)` | Deletes the variables. |

After each test, every variable `env.set` stubbed goes back to its previous value. Deletions are
not undone. Variables the code reads when its module loads belong in the Vitest configuration's
`env`, because the module has loaded before the test runs.

```typescript
it.beforeEach(({ env }) => {
  env.set({ enableTodoMetadata: "false" });
});
```

## http

`http` intercepts outbound HTTP requests, using [nock](https://github.com/nock/nock).

| Method | Intercepts |
| --- | --- |
| `http.gateway(name, version = "v1")` | `https://execute-api.eu-west-2.amazonaws.com/gateways/<name>/<version>` |
| `http.domain(name, version = "v1")` | `https://execute-api.eu-west-2.amazonaws.com/domains/<name>/<version>` |
| `http.url(baseUrl)` | Any path under `baseUrl` |

`gateway` and `domain` stand in for the private API Gateway, so the code under test must be
configured with `https://execute-api.eu-west-2.amazonaws.com` as its private gateway URL.

Each returns `get`, `post`, `put`, `patch` and `delete`. Each takes the path under the prefix and
these options, and returns `reply(status, body?)`:

| Option | Matches |
| --- | --- |
| `headers` | Each header given must have this value. Other headers are ignored. |
| `query` | The query string must be exactly these parameters. |
| `body` | The request body. |

`reply` returns another `reply`, which answers the next identical request, so a chain replies in
order:

```typescript
it("retries after a 503", async ({ http, sdk }) => {
  http
    .gateway("udp")
    .get("/identity/dvla", { headers: { "User-Id": userId } })
    .reply(503)
    .reply(200, serviceIdentityLink);

  // …
});
```

After each test, `http` removes every interceptor. If any interceptor was not used, it throws and
the test fails, listing the requests that never arrived. Register only the requests the test
expects.

## sdk

`sdk` builds the events and context for a domain handler created with `route()` from `@flex/sdk`,
and the result to compare with.

```typescript
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/customer/licence", () => {
  it("returns the licence", async ({ http, sdk }) => {
    http.gateway("dvla").get("/authenticate").reply(200, session);

    const result = await handler(
      sdk.event.get("/customer/licence", { auth: userId }),
      sdk.context(),
    );

    expect(result).toStrictEqual(sdk.result(200, { body: licence }));
  });
});
```

### sdk.event

`sdk.event.get`, `post`, `put`, `patch` and `delete` each take a path and options, and build an
API Gateway proxy event with a Lambda authorizer context.

| Option | Sets |
| --- | --- |
| `auth` | The caller. A `UserId` sets the authorizer's `pairwiseId` and `principalId`, which the handler sees as `auth.pairwiseId`. `false` sets them to empty strings, which the SDK treats as an unauthenticated request. Without `auth`, the caller is `test-user-id`. |
| `headers` | Request headers, added to `Content-Type: application/json`. |
| `params` | `pathParameters`. |
| `query` | `queryStringParameters`. For an array value, the last item is used. |
| `body` | The body, serialised as JSON. Only `post`, `put` and `patch` take it. Give a type argument, `sdk.event.post<NewTodo>(path, { body })`, to make `body` required and typed. |

`sdk.event(overrides)` builds an event from the base event with any field overridden, deeply. See
[Builders](#builders).

### sdk.context

`sdk.context(options?)` builds the Lambda context.

| Option | Sets |
| --- | --- |
| `secrets` | Values for the route's `secret` resources, set on the context by key. |
| `params` | Values for the route's `ssm:runtime` resources, set on the context by key. |
| `userId` | `context.userId`. Defaults to `test-user-id`. |
| `overrides` | Any Lambda context field, such as `functionName`. |

```typescript
sdk.context({
  secrets: { apiKey: "test-api-key" }, // pragma: allowlist secret
  params: { featureConfig: "test-value" },
});
```

See [Resources](/flex/domains/resources/) for which resources are read at runtime.

### sdk.result

`sdk.result(statusCode, options?)` builds the API Gateway result a handler should return: the status
code, `Content-Type: application/json` plus any `headers` given, and `body` serialised as JSON.
Other options override fields of the result.

## platform

`platform` builds the events, context and results for service gateways and platform handlers.

| Member | Builds |
| --- | --- |
| [`gatewayEvent`](#gatewayevent) | A request to a service gateway. |
| [`gatewayResult`](#gatewayresult) | The result a service gateway returns. |
| [`authorizerEvent`](#authorizerevent) | A Lambda token authorizer event. |
| [`authorizerResult`](#authorizerresult) | The policy an authorizer returns. |
| [`cloudFrontEvent`](#cloudfrontevent) | A CloudFront Functions viewer request event. |
| [`cloudFrontResult`](#cloudfrontresult) | The response a CloudFront Function returns. |
| [`context`](#context) | A Lambda context. |
| [`dynamodb`](#dynamodb) | DynamoDB document client stubs. |
| [`secret`](#secret) | Secrets Manager stubs. |

The test file must load [`setup/platform`](#setupplatform).

```typescript
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./gateway";

describe("Travel Service Gateway", () => {
  it.beforeEach(({ env, platform }) => {
    env.set({
      FLEX_TRAVEL_CONSUMER_CONFIG_SECRET_ARN: platform.secret.resolves(
        "travel-consumer",
        consumerConfig,
      ),
    });
  });

  it("returns every country", async ({ platform }) => {
    platform.dynamodb.scan.resolves([franceRow, germanyRow]);

    const result = await handler(
      platform.gatewayEvent.get("/v1/countries"),
      platform.context(),
    );

    expect(result).toStrictEqual(
      platform.gatewayResult(200, { body: [france, germany] }),
    );
  });
});
```

### gatewayEvent

`platform.gatewayEvent.get`, `post`, `put`, `patch` and `delete` each take a path and options, and
build an API Gateway proxy event for `/gateways/<name><path>`. The name comes from the
`FLEX_GATEWAY_NAME` environment variable, which the gateway's Vitest configuration sets in `env`.
Without it, the builder throws.

| Option | Sets |
| --- | --- |
| `headers` | Request headers. |
| `query` | `queryStringParameters`. For an array value, the last item is used. |
| `body` | The body, serialised as JSON. Only `post`, `put` and `patch` take it. |

`platform.gatewayEvent(overrides)` builds from the base event with any field overridden.

### gatewayResult

`platform.gatewayResult(statusCode, options?)` builds a gateway result: the status code,
`Content-Type: application/json` plus any `headers` given, and `body` serialised as JSON. Without
`body`, the result has none.

### authorizerEvent

`platform.authorizerEvent(overrides?)` builds a `TOKEN` authorizer event. By default
`authorizationToken` is `Bearer` followed by [`validJwt`](#test-data), and `methodArn` is
`arn:aws:execute-api:eu-west-2:123456789012:api-id/$default/GET/v1/example`.

```typescript
platform.authorizerEvent({ authorizationToken: `Bearer ${expiredJwt}` });
```

### authorizerResult

`platform.authorizerResult(effect, resource, options?)` builds an IAM policy with one
`execute-api:Invoke` statement for `effect` (`"Allow"` or `"Deny"`) on `resource` (a string or an
array). `principalId` defaults to `anonymous` and `context` to `undefined`. `options` sets either.

```typescript
expect(result).toStrictEqual(platform.authorizerResult("Deny", "*"));
```

### cloudFrontEvent

`platform.cloudFrontEvent.get`, `post`, `put`, `patch` and `delete` each take a URI and options, and
build a CloudFront Functions `viewer-request` event.

| Option | Sets |
| --- | --- |
| `headers` | `request.headers` |
| `cookies` | `request.cookies` |
| `query` | `request.querystring` |

Each option takes plain strings, `{ "x-trace-id": "abc" }`, or CloudFront's own
`{ value }` objects. Names are lowercased, as CloudFront delivers them.

### cloudFrontResult

`platform.cloudFrontResult(statusCode, options?)` builds the response a CloudFront Function returns
when it rejects a request.

| Option | Sets |
| --- | --- |
| `headers`, `cookies` | Converted as for `cloudFrontEvent`. |
| `body` | `body.data`: a string as it is, anything else serialised as JSON. |
| `encoding` | `body.encoding`: `text` (default) or `base64`. |
| `statusDescription` | `statusDescription`. |

### context

`platform.context(overrides?)` is [`buildLambdaContext`](#test-data).

## dynamodb

`platform.dynamodb` stubs the commands sent through a `DynamoDBDocumentClient`, which is what a
gateway client from `createDynamoDBClient` uses (see [Clients](/flex/gateways/clients/)). It mocks
the document client with [aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock).
The mock is installed the first time a test uses the fixture, and stays installed for the rest of
the file. `createDynamoDBFixture()` returns the same helpers outside the `platform` fixture.

There is one helper per command: `scan`, `query`, `get`, `put`, `update` and `delete`. A stub
answers every command of its type, whatever table or key the command names.

| Helper | Does |
| --- | --- |
| `scan.resolves(...pages)` | Each argument is a page of items. Every page but the last carries a `LastEvaluatedKey`, so the client only reaches later pages if it follows the key. The last page answers every scan after it. With no pages, scans return no items. |
| `query.resolves(...pages)` | The same, for `Query`. |
| `scan.cursor(page = 0)`, `query.cursor(page = 0)` | The `LastEvaluatedKey` given with that page, to check the `ExclusiveStartKey` of the next request. |
| `get.resolves(item?)` | Returns the item. Without one, the item is not in the table. |
| `put.resolves()` | The write succeeds. |
| `update.resolves(attributes?)` | Returns the attributes as `Attributes`, which is what `ReturnValues: "ALL_NEW"` returns. |
| `delete.resolves()` | The delete succeeds. |
| `<command>.rejects(error?)` | The command fails, as an unreachable table or a denied role does. |
| `<command>.calls()` | The input of every command of that type the code sent, in order. |
| `<command>.input(index = 0)` | The input of one of them, or `undefined`. |
| `client()` | The underlying mock, for commands without a helper, such as `BatchWriteCommand`. |

```typescript
it("stores the source the caller sent", async ({ platform }) => {
  platform.dynamodb.put.resolves();

  await handler(
    platform.gatewayEvent.post("/v1/sources", { body: source }),
    platform.context(),
  );

  expect(platform.dynamodb.put.input()).toMatchObject({ Item: source });
});
```

## secret

`platform.secret` stubs the Secrets Manager reads that a gateway's `secret` resources make through
Powertools. Each stub answers only for the secret it names, by ARN:
`arn:aws:secretsmanager:<AWS_REGION>:123456789012:secret:<name>`, with `eu-west-2` when `AWS_REGION`
is not set.

| Helper | Does |
| --- | --- |
| `resolves(name, value)` | Stubs the secret and returns its ARN. A string value is returned as it is, anything else serialised as JSON. |
| `rejects(name, error?)` | Makes reading the secret fail, as a missing secret or a denied policy does. Returns its ARN. |
| `arn(name)` | The ARN, without stubbing anything. |
| `calls()` | The input of every secret read, in order. |

Set the returned ARN as the environment variable the gateway's resource reads, as in the
[`platform` example](#platform). Use `secret` rather than intercepting the Secrets Manager
endpoint with `http`.

## Builders

The event and result builders above are made with these, and test files use them for their own
test data.

| Export | Does |
| --- | --- |
| `createFixtureBuilder(base)` | Returns a builder: `(overrides?) => value`. Overrides are merged into a copy of `base` deeply. Nested objects merge; arrays and other values are replaced. |
| `createFixtureVariants(base, variants)` | A builder with named methods. `variants` receives the builder and returns the methods. `sdk.event`, `platform.gatewayEvent` and `platform.cloudFrontEvent` are built this way. |
| `mergeFixture(base, overrides?)` | The deep merge on its own. |
| `FixtureBuilder`, `FixtureVariants` | Their types. |

```typescript
import { createFixtureBuilder, createFixtureVariants } from "@flex/testing";

export const buildSession = createFixtureBuilder({
  "id-token": "test-token",
  expiresIn: 3600,
});

buildSession({ expiresIn: 0 });

export const buildTodo = createFixtureVariants(
  { id: "todo-1", title: "Untitled", completed: false },
  (build) => ({
    done: (title: string) => build({ title, completed: true }),
  }),
);

buildTodo.done("Renew licence");
buildTodo({ title: "Book test" }); // the builder is still callable
```

## Test data

| Export | Value |
| --- | --- |
| `buildLambdaContext(overrides?)` | A Lambda context with `functionName` `test-function`, `awsRequestId` `test-request-id`, 128 MB and 30 seconds remaining. `ContextOverrides` is the type of its argument. |
| `createUserId(id = "test-user-id")`, `userId` | A branded `UserId`, and the default one. |
| `createUuid(value?)`, `uuid` | A fixed UUID, and the default one. |
| `createTimestamp(value?)`, `timestamp` | An ISO timestamp, `2026-06-04T12:00:00.000Z` by default. |
| `createToken(value?)`, `token` | A token string, the default UUID by default. |
| `validJwt` | An RS256 access token in the shape Cognito issues, signed with the key in `publicJWKS`. It expires in 2121. |
| `validJwtUsername` | The `username` claim of `validJwt`. |
| `jwtMissingUsername` | `validJwt` without the `username` claim. |
| `expiredJwt` | An access token that expired in January 2026. |
| `invalidJwt` | `invalid.jwt.token`, which is not a JWT. |
| `publicJWKS` | The JWKS holding the public key for `validJwt`. |

## E2E harness

`@flex/testing/e2e` is the harness for tests that run against a deployed stage: a domain's tests in
`domains/<name>/e2e` and the platform suite in `tests/e2e`. Running them is described in
[E2E tests](/flex/delivery/e2e-tests/).

### it (E2E)

```typescript
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("GET /dvla/v1/customer/licence", () => {
  it("rejects a request without a token", async ({ cloudfront }) => {
    const result = await cloudfront.client.get("/dvla/v1/customer/licence");

    expect(result.status).toBe(401);
  });

  it("returns the licence", async ({ cloudfront, authHeader }) => {
    const result = await cloudfront.client.get("/dvla/v1/customer/licence", {
      headers: authHeader,
    });

    expect(result.status).toBe(200);
  });
});
```

| Fixture | Holds |
| --- | --- |
| `cloudfront` | A [`createApi`](#createapi) client for `<FLEX_API_URL>/app`: the public API, through CloudFront. |
| `docs` | A client for `FLEX_API_URL` itself. |
| `privateGateway` | A client for `FLEX_PRIVATE_GATEWAY_URL`. |
| `authHeader` | `{ Authorization: "Bearer <JWT.VALID>", "x-flex-e2e-bypass": <E2E_BYPASS_TOKEN> }`. The bypass header stops the WAF's IP reputation rules from blocking the test runner. |
| `udpUser` | The body of `GET /udp/v1/users/me` for the test user, which makes sure the user exists. |
| `withCleanIdentity` | `(service) => Promise<void>`. Deletes the user's identity link for the service, failing on any status but 204 or 404, and deletes it again after the test. |
| `withIdentityLink` | `(service, id) => Promise<ApiResponse>`. Deletes any link for the service, then links it with `id` as the `x-linking-token`, and deletes it again after the test. |

Each client is given the test's abort signal, so its requests stop when the test times out. The
last three fixtures call the UDP domain, and are only in the `it` exported here.

### extendIt

`extendIt()` returns Vitest's `it` extended with only `cloudfront`, `docs`, `privateGateway` and
`authHeader`. Chain `.extend()` on it to add a suite's own fixtures, as
[`e2e/it.ts`](https://github.com/govuk-once/flex/blob/main/libs/testing/src/e2e/it.ts) does for the
UDP fixtures.

### createApi

`createApi(baseUrl, options?)` returns `{ client }`, an HTTP client for one base URL. `options.signal`
is an `AbortSignal` for every request.

| Method | Sends |
| --- | --- |
| `client.get(path, options?)`, `client.delete(path, options?)` | A request without a body. |
| `client.post`, `client.put`, `client.patch` | A request with an optional body. |
| `client.request(method, path, options?)` | A request with any method. |

| Request option | Sets |
| --- | --- |
| `headers` | Request headers, added to `Content-Type: application/json`. |
| `params` | The query string. |
| `body` | The body, serialised as JSON. |
| `signal` | An `AbortSignal` for this request. |

Every method resolves to an `ApiResponse`: `status`, `statusText`, `headers`, `body` and `raw`, the
unread `Response`. `body` is parsed with [`parseResponseBody`](/flex/reference/flex-utils/#http). A
4xx or 5xx status does not throw. Type arguments set the body types:
`client.get<Licence>(path)`, `client.post<NewTodo, Todo>(path, { body })`.

```typescript
import { createApi } from "@flex/testing/e2e";
import { inject } from "vitest";

const { FLEX_API_URL } = inject("e2eEnv");
const api = createApi(`${FLEX_API_URL}/app`);

const result = await api.client.get("/dvla/v1/customer/licence");
```

### Injected environment

The [global setup](#global-setup) resolves the stage once per run and provides the values to every
test file. Read them with `inject("e2eEnv")` from `vitest`. `e2eEnvSchema` validates them, and
`E2EEnv` is their type.

| Value | Holds |
| --- | --- |
| `FLEX_API_URL` | Base URL of the stage's public domain, served by CloudFront. |
| `FLEX_PRIVATE_GATEWAY_URL` | Base URL of the stage's private API Gateway. |
| `JWT.VALID` | An access token for the test user. |
| `JWT.INVALID` | [`invalidJwt`](#test-data). |
| `E2E_BYPASS_TOKEN` | The value for the `x-flex-e2e-bypass` header. |
| `STAGE` | The stage name. |
| `ENVIRONMENT` | `development`, `staging` or `production`: the stage when it is one of those, otherwise `development`. It is derived from the `STAGE` or `USER` environment variable. |

### Global setup

`@flex/testing/e2e/setup` is the Vitest global setup that `e2eConfig` and the platform suite use.
It loads `.env`, works out the stage, URLs and tokens, and provides them, validated by
`e2eEnvSchema`, as `e2eEnv`. Where each value comes from, and the variables that override it, are
in [How a suite finds the stage](/flex/delivery/e2e-tests/#how-a-suite-finds-the-stage).

## Token generators

Exported from `@flex/testing/auth`, and also from `@flex/testing/e2e` apart from `getAccessToken`
and `OneLoginAuthConfig`. `@flex/testing/auth` does not load Vitest, so scripts such as the smoke
test and `pnpm jwt:playground` import from it.

Every generator implements `BaseTokenGenerator`: `getToken(): Promise<string>`.

| Export | Does |
| --- | --- |
| `getStubTokenGenerator()` | Reads a private JWK from the Secrets Manager secret `/development/flex-secret/auth/e2e/private_jwk` and returns a stub generator. |
| `getStubTokenGeneratorFromJWK(jwk)` | A stub generator for a private JWK you already have. |
| `STUB_DEFAULT_SUBJECT` | The `sub` a stub token has unless another is given. |
| `getTokenGenerator(stage)` | For `staging` or `production`. Reads the test user's email, password and TOTP seed from `/<stage>/flex-secret/e2e/test_user`, and the auth client settings from the SSM parameters under `/<stage>/flex-param/auth/`. Returns a generator that signs in through One Login. |
| `createTokenGeneratorFromConfig(config)` | A One Login generator from a `JwtAuthConfig` you supply. |
| `getAccessToken(config)` | Runs one One Login sign-in and returns the access token. |
| `JwtAuthConfig`, `OneLoginAuthConfig` | The same type: `email`, `password`, `totp`, `clientId`, `authUrl`, `tokenUrl`, `redirectUri`, `oneLoginEnvironment` and an optional `attestationToken`. |

A stub generator's `getToken(sub?)` signs an RS256 token that expires in an hour, with the claims
Cognito puts in an access token and a `username` of `onelogin_<sub>`. It also exposes `publicJWKS`
and `kid`. Only stages in the development environment accept these tokens: their authorizer
trusts the stub key instead of Cognito. See [Lambda authorizer](/flex/edge/authorizer/).

The One Login sign-in follows the app's flow: an authorisation code request with PKCE, then the
email, password and authenticator code pages, then the token exchange.
