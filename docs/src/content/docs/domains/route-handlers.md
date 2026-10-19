---
title: Writing route handlers
description: What a handler receives, what it returns and how errors are handled.
sidebar:
  order: 3
---

Each route in [`domain.config.ts`](/flex/domains/domain-config/) has one handler file. The handler is built with the `route` function that the config exports.

```ts title="src/handlers/v1/topics/get.ts"
import { route } from "@domain";

export const handler = route("GET /v1/topics", async ({ auth, logger }) => {
  logger.info("Fetching topics", { userId: auth.userId });

  return { status: 200, data: { topics: [] } };
});
```

- `@domain` is a path alias for `domain.config.ts`, set in the domain's `tsconfig.json`.
- The first argument is the **route key**: `METHOD /version/path`, with ` [private]` on the end for a private route. Only keys that exist in the config type-check.
- The export must be called `handler`.

## The context

The handler receives one object, the **context**. Its type comes from the route's config.

### What it contains

The context only has what the route declares:

| Property       | Present when                             | Type                                           | See                                             |
| -------------- | ---------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `logger`       | Always                                   | `Logger` from `@flex/logging`                  | [With logging](#with-logging)                   |
| `auth`         | Public routes                            | `{ userId: UserId }`                           | [With auth](#with-auth)                         |
| `body`         | The route has a `body` schema            | Inferred from the schema                       | [With a request body](#with-a-request-body)     |
| `pathParams`   | The path has `:param` segments           | `{ [param]: string }`                          | [With path parameters](#with-path-parameters)   |
| `queryParams`  | The route has a `query` schema           | Inferred from the schema                       | [With query parameters](#with-query-parameters) |
| `headers`      | The route, or `common`, declares headers | `string`, or `string \| undefined` if optional | [With headers](#with-headers)                   |
| `resources`    | The route lists resources                | `{ [key]: string }`                            | [With resources](#with-resources)               |
| `integrations` | The route lists integrations             | Typed clients                                  | [With integrations](#with-integrations)         |
| `featureFlags` | The route lists feature flags            | `{ [key]: boolean }`                           | [With feature flags](#with-feature-flags)       |

To read the context from a helper function instead of the handler, see [With route context](#with-route-context).

### Request validation

The SDK validates the request before your handler runs. A request that fails validation never reaches it:

| Input         | When it fails                           | Response                                                     |
| ------------- | --------------------------------------- | ------------------------------------------------------------ |
| `body`        | `Content-Type` isn't `application/json` | `415`                                                        |
| `body`        | Missing or malformed JSON               | `422`                                                        |
| `body`        | Doesn't match the schema                | `400`, `validation_error`                                    |
| `queryParams` | Doesn't match the schema                | `400`, `validation_error`, with an `errors` entry per field  |
| `headers`     | A required header is missing            | `400`, `validation_error`, with an `errors` entry per header |

The `415` and `422` come from the JSON body parser middleware, before the SDK's own validation. Unlike every other error here, they are plain text (`Content-Type: text/plain`), not the [error contract](#errors), and they are logged at `ERROR` as `Unhandled error`.

## Handler patterns

Each pattern below shows the config a route needs and how its handler reads the result. Combine them as the route needs.

### With logging

Every handler gets a `logger`:

```ts
export const handler = route("GET /v1/topics", async ({ logger }) => {
  logger.info("Fetching topics");

  return { status: 200, data: { topics: [] } };
});
```

- Its service name is `<domain>-<public or private>-<version>-<route name>`, for example `topics-public-v1-retrieve-topics`.
- It carries the request's `x-correlation-id`, so you can follow one request across Lambdas.
- Its level comes from the route's `logLevel`, then `common.logLevel`, then `INFO`. In `production` the logger stays at `INFO` whatever you set.
- At `DEBUG` or `TRACE` the whole incoming event is logged too, and this still happens in `production`. See the warning under [Returning a response](#returning-a-response).
- Redaction is partial. It matches field names such as `authorization`, `token`, `password` and `email`, and some values such as JWTs and email addresses. Anything else is logged as it is, so don't log data you wouldn't want to see in a log. See [Log redaction](/flex/observability/log-redaction/).

Log the outcome, not the payload. `userId` is pseudonymous and safe to log.

### With auth

Public routes get `auth`. `auth.userId` is the user's pseudonymous id, taken from the authorizer and parsed into the branded `UserId` type from `@flex/utils`. Pass it straight to anything that takes a `UserId`. If it's missing, the SDK returns a `401` before your handler runs.

```ts title="src/handlers/v1/topics/get.ts"
export const handler = route("GET /v1/topics", async ({ auth, logger }) => {
  logger.info("Fetching topics", { userId: auth.userId });
  // ...
});
```

Private routes have no `auth`, because no user token reaches them. Declare a header for the user id instead, and have the caller send it:

```ts title="domain.config.ts"
POST: {
  private: {
    name: "create-topic",
    headers: { userId: { name: "requesting-service-user-id" } },
  },
},
```

```ts title="src/handlers/v1/topics/post.private.ts"
export const handler = route(
  "POST /v1/topics [private]",
  async ({ headers }) => {
    const { userId } = headers;
    // ...
  },
);
```

:::caution
TypeScript currently allows `auth` on private routes, but it is `undefined` at runtime. Don't use it there.
:::

### With a request body

A route with a `body` schema gets `body`, already parsed and typed. `body` is only allowed on `POST`, `PUT` and `PATCH`.

```ts title="domain.config.ts"
const UpdateTopicsRequestSchema = z.object({
  topicIds: z.array(NonEmptyString),
});

// ...
PATCH: {
  public: { name: "update-topics", body: UpdateTopicsRequestSchema },
},
```

```ts title="src/handlers/v1/topics/patch.ts"
export const handler = route("PATCH /v1/topics", async ({ body, logger }) => {
  // body is typed as { topicIds: string[] }
  logger.info("Updating topics", { count: body.topicIds.length });

  return { status: 204 };
});
```

### With path parameters

Each `:param` segment in the path becomes a property of `pathParams`. The handler file goes in a `[param]` directory.

```ts title="domain.config.ts"
"/topics/:id": {
  GET: {
    public: { name: "get-topic" },
  },
},
```

```ts title="src/handlers/v1/topics/[id]/get.ts"
export const handler = route("GET /v1/topics/:id", async ({ pathParams }) => {
  const { id } = pathParams;
  // ...
});
```

`pathParams` are not validated, and are always strings. Parse them yourself if you need a number, an id type or a fixed set of values:

```ts
const id = NonEmptyString.safeParse(pathParams.id);

if (!id.success) {
  throw new createHttpError.BadRequest("Invalid topic id");
}
```

### With query parameters

A route with a `query` schema gets `queryParams`, validated and typed. Query parameters arrive as strings, so convert them in the schema:

```ts title="domain.config.ts"
const ListTopicsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  includeArchived: z.stringbool().optional(),
});

// ...
GET: {
  public: { name: "list-topics", query: ListTopicsQuerySchema },
},
```

```ts title="src/handlers/v1/topics/get.ts"
export const handler = route("GET /v1/topics", async ({ queryParams }) => {
  // queryParams is typed as { limit: number; includeArchived?: boolean }
  const { limit, includeArchived } = queryParams;
  // ...
});
```

:::caution
Don't use `z.coerce.boolean()` for a query parameter. Any non-empty string, including `"false"`, becomes `true`. Use `z.stringbool()`.
:::

### With headers

A route that declares headers gets `headers`, keyed by the names you give them. Headers in `common` are merged in, and the route's own win. A missing required header gets a `400` before the handler runs.

```ts title="domain.config.ts"
common: {
  headers: { traceId: { name: "x-trace-id", required: false } },
},
// ...
PATCH: {
  private: {
    name: "update-topics",
    headers: { userId: { name: "requesting-service-user-id" } },
  },
},
```

```ts title="src/handlers/v1/topics/patch.private.ts"
export const handler = route(
  "PATCH /v1/topics [private]",
  async ({ headers }) => {
    // userId: string, traceId: string | undefined
    const { userId, traceId } = headers;
    // ...
  },
);
```

Header names are case-insensitive. See [Headers](/flex/domains/domain-config/#headers) for the options.

### With resources

A route that lists resources gets `resources`, with the resolved value of each: an SSM parameter value, a secret value or a KMS key ARN. Runtime resources (`secret`, `ssm:runtime`) are fetched by middleware before the handler runs.

```ts title="domain.config.ts"
resources: {
  apiKey: { type: "secret", path: "/flex-secret/<domain>/example-api-key" },
  encryptionKeyArn: { type: "kms", path: "/flex-secret/encryption-key" },
},
// ...
GET: {
  public: { name: "get-topics", resources: ["apiKey", "encryptionKeyArn"] },
},
```

```ts title="src/handlers/v1/topics/get.ts"
export const handler = route("GET /v1/topics", async ({ resources }) => {
  const { apiKey, encryptionKeyArn } = resources;
  // ...
});
```

Never log a resource value. See [Resources](/flex/domains/domain-config/#resources) for the types and how paths resolve.

### With integrations

A route that lists integrations gets `integrations`, with a typed client for each. A call returns a result instead of throwing for an HTTP error, so check `ok` first:

```ts title="src/handlers/v1/topics/get.ts"
export const handler = route(
  "GET /v1/topics",
  async ({ auth, integrations, logger }) => {
    const result = await integrations.udpGetTopics({
      headers: { "requesting-service-user-id": auth.userId },
    });

    if (!result.ok) {
      logger.error("Failed to get topics", { status: result.error.status });

      throw new createHttpError.BadGateway();
    }

    return { status: 200, data: result.data };
  },
);
```

See [Calling other domains and gateways](/flex/domains/calling-other-domains/) for how to declare integrations, wildcard routes, results and retries.

### With feature flags

A route that lists feature flags gets `featureFlags`, with a boolean for each:

```ts title="src/handlers/v1/topics/get.ts"
export const handler = route("GET /v1/topics", async ({ featureFlags }) => {
  if (featureFlags.newTopicsEnabled) {
    // ...
  }
  // ...
});
```

See [Feature flags](/flex/domains/feature-flags/) for how to declare them.

### With route context

As a handler grows, you may split it into helper functions. You can pass the values they need as arguments, or have them read the route's context with `routeContext`:

```ts title="src/handlers/v1/topics/get.ts"
import { route, routeContext } from "@domain";

const context = routeContext<"GET /v1/topics">;

export const handler = route("GET /v1/topics", async () => {
  const topics = await getTopics();

  return { status: 200, data: { topics } };
});

async function getTopics() {
  const { auth, integrations } = context();
  // ...
}
```

`routeContext` is optional. A small handler doesn't need it. It only works while a handler is running, so calling `context()` at module level throws.

See [Route context](/flex/domains/route-context/) for when to use it, sharing helpers across routes, and examples from simple to complex handlers.

## Returning a response

A handler returns an object with a `status`, and `data` if there is a body. To return an error, throw instead. See [Errors](#errors).

### With a body

`data` is sent as JSON:

```ts
return { status: 200, data: { topics } };
```

### Without a body

Leave out `data`, for example for a `204`:

```ts
return { status: 204 };
```

### Response validation

If the route has a `response` schema, `data` is checked twice:

- **At build time**, TypeScript checks `data` against the schema.
- **At runtime**, the SDK checks it again. A mismatch returns a `500`, logs the Zod issues and emits a `response_validation_failed` telemetry event.

With `logLevel` set to `DEBUG` or `TRACE`, the Zod issues are also included in the response body, which helps while developing.

:::danger
This happens in `production` too, along with logging the whole incoming event. Never promote a route with `logLevel` set to `DEBUG` or `TRACE`.
:::

## Errors

For an error response, throw an [`http-errors`](https://github.com/jshttp/http-errors) error:

```ts
import createHttpError from "http-errors";

if (!result.ok) {
  logger.error("Failed to get topics", { status: result.error.status });

  throw new createHttpError.BadGateway();
}
```

The SDK turns it into the standard error body. For a `5xx` the message is always generic:

```json
{ "message": "Internal server error", "type": "server_error" }
```

| Status       | `type`         | `message`                                                                   |
| ------------ | -------------- | --------------------------------------------------------------------------- |
| `401`, `403` | `auth_error`   | Your message                                                                |
| Other `4xx`  | `client_error` | Your message, for example `new createHttpError.NotFound("Topic not found")` |
| `5xx`        | `server_error` | Always generic. Your message is logged, not returned.                       |

Request validation failures use `validation_error`, as above.

Anything else thrown, such as a plain `Error` or an exception from a library, is logged, emits an `error_thrown` telemetry event and returns a `500` with an **empty body**, not the error contract. Catch what you expect to fail and throw an `http-errors` error instead.

You can also return `{ status, error }` instead of throwing, but the body then carries a deprecated `error` field as well. Prefer throwing.

The full error contract is `ErrorResponse` in [`@flex/utils`](https://github.com/govuk-once/flex/tree/main/libs/utils). How to map upstream failures to these is covered in [Calling other domains and gateways](/flex/domains/calling-other-domains/#handle-upstream-errors).
