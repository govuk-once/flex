# @flex/testing

Test utilities, fixtures and extended test functions for FLEX.

This package provides two entry points:

- `@flex/testing` - Unit testing with Vitest fixtures
- `@flex/testing/e2e` - End-to-end testing with Vitest fixtures against deployed infrastructure

---

## Commands

Run these from the repository root:

| Command                            | Description    |
| ---------------------------------- | -------------- |
| `pnpm --filter @flex/testing lint` | Lint files     |
| `pnpm --filter @flex/testing tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `libs/testing/`.

## API

### @flex/testing

| Name                                                      | Description                                 | Code                                 |
| --------------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| [`it`](#it)                                               | Extended Vitest test function with fixtures | [View](./src/extend/it.ts)           |
| [`event`](#event)                                         | Base API Gateway V2 event                   | [View](./src/fixtures/apigateway.ts) |
| [`createEvent`](#createevent)                             | Factory for API Gateway V2 events           | [View](./src/fixtures/apigateway.ts) |
| [`eventWithAuthorizer`](#eventwithauthorizer)             | Base event with Lambda authorizer           | [View](./src/fixtures/apigateway.ts) |
| [`createEventWithAuthorizer`](#createeventwithauthorizer) | Factory for events with authorizer          | [View](./src/fixtures/apigateway.ts) |
| [`authorizerEvent`](#authorizerevent)                     | Base Lambda authorizer event                | [View](./src/fixtures/apigateway.ts) |
| [`createAuthorizerEvent`](#createauthorizerevent)         | Factory for Lambda authorizer events        | [View](./src/fixtures/apigateway.ts) |
| [`authorizerResult`](#authorizerresult)                   | Base Lambda authorizer results              | [View](./src/fixtures/apigateway.ts) |
| [`createAuthorizerResult`](#createauthorizerresult)       | Factory for Lambda authorizer results       | [View](./src/fixtures/apigateway.ts) |
| [`context`](#context)                                     | Base Lambda context                         | [View](./src/fixtures/lambda.ts)     |
| [`createContext`](#createcontext)                         | Factory for Lambda contexts                 | [View](./src/fixtures/lambda.ts)     |
| [`response`](#response)                                   | Base HTTP responses                         | [View](./src/fixtures/response.ts)   |
| [`createResponse`](#createresponse)                       | Factory for HTTP responses                  | [View](./src/fixtures/response.ts)   |
| [`config`](#config)                                       | Test configuration defaults                 | [View](./src/config/index.ts)        |

### @flex/testing/e2e

| Name                                                | Description                              | Code                         |
| --------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| [`it`](#it-e2e)                                     | Extended test function with E2E fixtures | [View](./src/e2e/it.ts)      |
| [`createApi`](#createapi)                           | HTTP client factory for E2E tests        | [View](./src/e2e/api.ts)     |
| [`e2eEnvSchema`](#e2eenvschema)                     | Zod schema for E2E environment variables | [View](./src/e2e/schemas.ts) |
| [`flexStackOutputsSchema`](#flexstackoutputsschema) | Zod schema for CDK stack outputs         | [View](./src/e2e/schemas.ts) |

---

## `it`

Extended Vitest test function that provides fixtures for unit testing Lambda handlers.

### Usage

Import base mocks directly from `@flex/testing`:

```typescript
import { context, event, it, response } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./handler";

describe("GET /example", () => {
  it("returns 200", async () => {
    const result = await handler(event, context);

    expect(result).toEqual(response.ok);
  });
});
```

#### With Fixtures

Access fixtures via the test context for customisation and access to helper methods.

```typescript
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./handler";

describe("GET /example", () => {
  it("returns 200", async ({ context, event, response }) => {
    const result = await handler(
      event.get("/example"),
      context.create({
        // add overrides
      }),
    );

    expect(result).toEqual(response.ok({ message: "Custom success message" }));
  });
});
```

### Fixtures

| Fixture               | Description                      | Auto |
| --------------------- | -------------------------------- | ---- |
| `authorizerEvent`     | Lambda authorizer event builder  | -    |
| `authorizerResult`    | Lambda authorizer result builder | -    |
| `context`             | Lambda context builder           | -    |
| `env`                 | Environment variable helpers     | Yes  |
| `event`               | API Gateway event builder        | -    |
| `eventWithAuthorizer` | Event with authorizer builder    | -    |
| `middy`               | Middy request builder            | -    |
| `platform`            | Platform gateway fixtures        | -    |
| `response`            | HTTP response builder            | -    |

See [Vitest Automatic Fixtures](https://vitest.dev/guide/test-context.html#automatic-fixture) for more information on automatic fixtures

---

## `platform`

Fixtures for platform service gateway handlers. Requires the
`@flex/testing/setup/platform` setup file and `FLEX_GATEWAY_NAME` in the
package's Vitest config — the event builder prefixes paths with
`/gateways/<name>`.

| Helper             | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `gatewayEvent`     | REST API event builder, one variant per HTTP method        |
| `gatewayResult`    | Expected handler result, `body` is serialised for you      |
| `authorizerEvent`  | Lambda authorizer event builder                            |
| `authorizerResult` | Lambda authorizer policy builder                           |
| `cloudFrontEvent`  | CloudFront Function event builder                          |
| `cloudFrontResult` | CloudFront Function result builder                         |
| `context`          | Lambda context builder                                     |
| `dynamo`           | Stubs the DynamoDB reads a gateway's clients make          |
| `secret`           | Stubs the Secrets Manager reads a gateway's resources make |

### Usage

```typescript
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./gateway";

describe("Example Service Gateway", () => {
  it.beforeEach(({ env, platform }) => {
    // Stubs the secret and hands back the ARN the resource resolves from
    env.set({
      FLEX_EXAMPLE_CONSUMER_CONFIG_SECRET_ARN: platform.secret.resolves(
        "example-consumer",
        { tableName: "development-example", region: "eu-west-2" },
      ),
    });
  });

  it("returns the rows the table holds", async ({ platform }) => {
    platform.dynamo.scan.resolves([{ id: "1" }]);

    const result = await handler(
      platform.gatewayEvent.get("/v1/example"),
      platform.context(),
    );

    expect(result).toStrictEqual(
      platform.gatewayResult(200, { body: [{ id: "1" }] }),
    );
  });
});
```

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

## `event`

Base API Gateway V2 event with sensible defaults.

### Usage

```typescript
import { context, event } from "@flex/testing";

const result = await handler(event, context);
```

---

## `createEvent`

Factory for building API Gateway V2 events with HTTP method helpers.

### Usage

```typescript
import { it } from "@flex/testing";

it("example", async ({ event }) => {
  const mockEvent = event.create({
    // Pass overrides
  });
  const mockGetEvent = event.get("/users");
  const mockPostEvent = event.post("/users", { body: { name: "John" } });
  const mockPutEvent = event.put("/users/123", { body: { name: "Jane" } });
  const mockPatchEvent = event.patch("/users/123", { body: { name: "Joe" } });
  const mockDeleteEvent = event.delete("/users/123");
});
```

#### With Query Parameters

```typescript
it("with params", async ({ event }) => {
  const mockEvent = event.get("/users", {
    params: { page: 1, filter: ["active", "admin"] },
  });

  // rawQueryString: "page=1&filter=active&filter=admin"
  // queryStringParameters: { page: "1", filter: "admin" }
});
```

#### With Headers

```typescript
it("with headers", async ({ event }) => {
  const mockEvent = event.get("/users", {
    headers: { "X-Custom-Header": "value" },
  });
});
```

---

## `eventWithAuthorizer`

Base API Gateway V2 event with Lambda authorizer context.

### Usage

```typescript
import { context, eventWithAuthorizer } from "@flex/testing";

const result = await handler(eventWithAuthorizer, context);
```

---

## `createEventWithAuthorizer`

Factory for building events with Lambda authorizer context.

### Usage

```typescript
it("event with authorizor events", async ({ eventWithAuthorizer }) => {
  const authenticatedEvent =
    eventWithAuthorizer.authenticated("user-pairwise-id");
  const unauthenticatedEvent = eventWithAuthorizer.unauthenticated();
});
```

---

## `authorizerEvent`

Base Lambda authorizer event for testing authorizer handlers.

### Usage

```typescript
import { authorizerEvent, context } from "@flex/testing";

const result = await handler(authorizerEvent, context);
```

---

## `createAuthorizerEvent`

Factory for building Lambda authorizer request events.

### Usage

```typescript
it("authorizer events", async ({ authorizerEvent }) => {
  const forRoute = authorizerEvent.forRoute("GET", "/example");
  const withToken = authorizerEvent.withToken("my-jwt-token");
  const missingToken = authorizerEvent.missingToken();
});
```

---

## `authorizerResult`

Base Lambda authorizer results for allow and deny policies.

### Usage

```typescript
import { authorizerResult } from "@flex/testing";

expect(result).toEqual(authorizerResult.allow);
expect(result).toEqual(authorizerResult.deny);
```

---

## `createAuthorizerResult`

Factory for building Lambda authorizer results.

### Usage

```typescript
it("authorizer results", async ({ authorizerResult }) => {
  const allow = authorizerResult.allow();
  const allowWithId = authorizerResult.allowWithPairwiseId("user-123");
  const deny = authorizerResult.deny();
});
```

---

## `context`

Base Lambda context with sensible defaults.

### Usage

```typescript
import { context, event } from "@flex/testing";

const result = await handler(event, context);
```

---

## `createContext`

Factory for building Lambda contexts.

### Usage

```typescript
import { event } from "@flex/testing";

it("with custom context", async ({ context }) => {
  const result = await handler(
    event,
    context.create({
      functionName: "custom-function",
      awsRequestId: "custom-request-id",
    }),
  );
});
```

---

## `middyRequest`

Base Middy request object for testing middleware.

### Usage

```typescript
import { middyRequest } from "@flex/testing";

await myMiddleware.before(middyRequest);
```

---

## `response`

Base HTTP responses for common status codes.

### Usage

```typescript
import { context, event, response } from "@flex/testing";

const result = await handler(event, context);

expect(result).toEqual(response.ok);
expect(result).toEqual(response.notFound);
expect(result).toEqual(response.internalServerError);
```

### Available Responses

| Property              | Status |
| --------------------- | ------ |
| `ok`                  | 200    |
| `created`             | 201    |
| `accepted`            | 202    |
| `noContent`           | 204    |
| `badRequest`          | 400    |
| `unauthorized`        | 401    |
| `forbidden`           | 403    |
| `notFound`            | 404    |
| `conflict`            | 409    |
| `tooManyRequests`     | 429    |
| `internalServerError` | 500    |
| `badGateway`          | 502    |
| `serviceUnavailable`  | 503    |
| `gatewayTimeout`      | 504    |

---

## `createResponse`

Factory for building HTTP responses with custom bodies.

### Usage

```typescript
import { context, it } from "@flex/testing";

it("custom response", async ({ event, response }) => {
  const result = await handler(event.get("/users"), context);

  expect(result).toEqual(response.ok({ users: [] }));
});

it("error response", async ({ event, response }) => {
  const result = await handler(event.post("/users", { body: {} }), context);

  expect(result).toEqual(response.badRequest({ error: "Invalid" }));
});
```

---

## `config`

Test configuration object containing default values for environment variables and SSM parameters.

---

## `it` (E2E)

Extended Vitest test function for end-to-end tests against deployed infrastructure.

### Usage

```typescript
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("GET /hello", () => {
  it("via API Gateway", async ({ api }) => {
    const result = await api.client.get("/hello");
  });

  it("via CloudFront", async ({ cloudfront }) => {
    const result = await cloudfront.client.get("/hello");
  });
});
```

### Fixtures

| Fixture      | Description                            |
| ------------ | -------------------------------------- |
| `api`        | HTTP client configured for API Gateway |
| `cloudfront` | HTTP client configured for CloudFront  |

---

## `createApi`

Factory for creating HTTP clients for E2E tests.

### Usage

```typescript
import { createApi } from "@flex/testing/e2e";

const api = createApi("https://api.example.com");

const users = await api.client.get("/app/{version}/users");
```

---

## `e2eEnvSchema`

Zod schema for validating E2E environment variables.

---

## `flexStackOutputsSchema`

Zod schema for validating CDK stack outputs.

---

## Related

**FLEX:**

- [@flex/utils](/libs/utils/README.md)

**External:**

- [Vitest Test Context](https://vitest.dev/guide/test-context)
