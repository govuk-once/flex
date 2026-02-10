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
| [`middyRequest`](#middyrequest)                           | Base Middy request object                   | [View](./src/fixtures/middy.ts)      |
| [`createMiddyRequest`](#createmiddyrequest)               | Factory for Middy request objects           | [View](./src/fixtures/middy.ts)      |
| [`response`](#response)                                   | Base HTTP responses                         | [View](./src/fixtures/response.ts)   |
| [`createResponse`](#createresponse)                       | Factory for HTTP responses                  | [View](./src/fixtures/response.ts)   |
| [`config`](#config)                                       | Test configuration defaults                 | [View](./src/config/index.ts)        |
| [`ENV_DEFAULTS`](#env_defaults)                           | Default environment variables               | [View](./src/config/index.ts)        |
| [`SSM_DEFAULTS`](#ssm_defaults)                           | Default SSM parameter values                | [View](./src/config/index.ts)        |

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

#### With Environment Variables

The `env` fixture automatically stubs environment variables.

```typescript
import { context, event, it } from "@flex/testing";

import { handler } from "./handler";

it("uses custom env", async ({ env }) => {
  env.delete("UNUSED_VAR");
  env.set({ MY_VAR: "custom-value" });

  const result = await handler(event, context);
});
```

#### With SSM Parameters

The `ssm` fixture provides a mock SSM parameter store.

```typescript
import { context, event, it } from "@flex/testing";

it("uses custom SSM", async ({ ssm }) => {
  ssm.set({ "/my/param": "custom-value" });

  const result = await handler(event, context);
});
```

#### With Redis

The `redis` fixture provides a mock Redis client with an in-memory store.

```typescript
import { context, event, it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { getRedisClient } from "./redis";
import { handler } from "./handler";

vi.mock("./redis");

// Global hooks do not have access to custom fixtures.
// Use hooks from the extended `it` function instead.
it.beforeEach(({ redis }) => {
  vi.mocked(getRedisClient).mockReturnValue(redis.client);
});

it("caches data", async ({ redis }) => {
  redis.store.set("key", "value");

  const result = await handler(event, context);

  expect(redis.client.get).toHaveBeenCalledExactlyOnceWith("key");
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
| `redis`               | Mock Redis client and store      | Yes  |
| `response`            | HTTP response builder            | -    |
| `ssm`                 | Mock SSM parameter store         | Yes  |

See [Vitest Automatic Fixtures](https://vitest.dev/guide/test-context.html#automatic-fixture) for more information on automatic fixtures

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

## `createMiddyRequest`

Factory for building Middy request objects.

### Usage

```typescript
it("middy requests", async ({ middy }) => {
  const authenticated = middy.authenticated("user-123");
  await myMiddleware.before(authenticatedRequest);

  const unauthenticated = middy.unauthenticated();
  await myMiddleware.before(unauthenticatedRequest);

  const withEvent = middy.withEvent({
    // event with authorizer overrides
  });
  await myMiddleware.before(customEventRequest);

  const withContext = middy.withContext({
    // overrides
  });
  await myMiddleware.before(customContextRequest);

  const withResponse = middy.withResponse({
    // overrides
  });
  await myMiddleware.after(customResponseRequest);

  const withError = middy.withError(new Error("message"));
  await myMiddleware.onError(customErrorRequest);
});
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

## `ENV_DEFAULTS`

Default environment variable mappings applied automatically by the `env` fixture.

---

## `SSM_DEFAULTS`

Default SSM parameter values applied automatically by the `ssm` fixture.

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

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/middlewares](/libs/middlewares/README.md)
- [@flex/utils](/libs/utils/README.md)

**External:**

- [Vitest Test Context](https://vitest.dev/guide/test-context)
