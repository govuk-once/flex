---
title: Handlers
description: Writing a route handler with route(), the context it receives, what it returns, response validation, routeContext, and the platform's error responses.
---

A handler is the function that runs for one route. It is created with the `route()` function that
`domain()` returns, and exported as `handler` from the file the route's path gives. See
[Creating a domain](/flex/domains/creating-a-domain/#handler-file-names).

```typescript
import { route } from "@domain";

export const handler = route("GET /v1/hello", async ({ logger }) => {
  logger.info("Saying hello");

  return { status: 200, data: { message: "Hello" } };
});
```

The first argument is the [route key](/flex/domains/configuration/#route-keys). The second
receives the route's context and returns its result. `route()` turns them into an API Gateway
Lambda handler.

## What happens on a request

1. Middleware sets up the logger, taking the correlation id from the `x-correlation-id` header.
   For `POST`, `PUT` and `PATCH` routes it parses the JSON body. It fetches the route's `secret`
   and `ssm:runtime` resources.
2. The SDK builds the context. It reads the path parameters, validates the body and query
   parameters against their schemas, reads the resources, works out the feature flags, checks the
   declared headers, attaches the integrations and, on a public route, reads the user's pairwise
   id. A failure here returns an [error response](#error-responses) without running the handler.
3. The handler runs, with the context also available through [`routeContext`](#route-context).
4. If the route has a `response` schema, the SDK validates the result's `data` against it.
5. The SDK turns the result into an API Gateway response.
6. The SDK empties `/tmp`, whether the request succeeded or not.

Each step emits a telemetry event. See [Telemetry](/flex/observability/telemetry/).

## The handler context

The context holds only what the route's configuration gives it, and its type follows the
configuration. A property the route does not configure is not there, so reading it fails to
compile.

| Property | Present when | Holds |
| --- | --- | --- |
| `logger` | Always | The [logger](/flex/observability/logging/), named after the route |
| `auth` | The route is public | `{ pairwiseId }`, the user's pairwise id |
| `body` | The route has a `body` schema | The parsed, validated body |
| `queryParams` | The route has a `query` schema | The parsed, validated query parameters |
| `pathParams` | The path has a `:param` segment | Each parameter, as a string |
| `headers` | The route or `common` declares headers | Each declared header, by its key |
| `resources` | The route names resources | Each resource's value, by its key. See [Resources](/flex/domains/resources/). |
| `featureFlags` | The route names feature flags | Each flag, as a boolean. See [Feature flags](/flex/domains/configuration/#feature-flags). |
| `integrations` | The route names integrations | A function for each. See [Integrations](/flex/domains/integrations/). |

### auth

On a public route, the Lambda authorizer passes the user's pairwise id, and the SDK puts it in
`auth.pairwiseId`. If it is missing, the request fails with `401` before the handler runs.

A private route has no user. Take the user's id from a header the route declares:

```typescript
// domain.config.ts, on the private route
headers: { userId: { name: "User-Id" } },

// get.private.ts
export const handler = route(
  "GET /v1/identity/:service [private]",
  async ({ headers, pathParams }) => {
    const link = await findLink(headers.userId, pathParams.service);
    // ...
  },
);
```

The type of the context does not follow this rule exactly. It gives `auth` to any route whose
`access` is not `"public"`, private routes included. On a private route `auth` is `undefined` at
run time, so never read it there.

### body

On a `POST`, `PUT` or `PATCH` route with a `body` schema, `body` holds the request body, parsed
and validated. The type is the schema's output type, so defaults and transforms are applied.

```typescript
export const handler = route("PATCH /v1/user", async ({ body, logger }) => {
  logger.info("Updating user");
  await save(body);

  return { status: 204 };
});
```

The request must have a JSON `Content-Type`. A body that fails the schema returns `400` with the
message `Invalid request body`.

### queryParams

With a `query` schema, `queryParams` holds the parsed query string. Query values arrive as
strings, so coerce numbers in the schema:

```typescript
export const ListTodosQuerySchema = z.object({
  priority: TodoPrioritySchema.optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  page: z.coerce.number().optional().default(1),
});
```

`z.coerce.boolean()` turns any non-empty string into `true`, `"false"` included. Use
`z.stringbool()` for a boolean parameter. A query string that fails the schema returns `400` with
an `errors` entry for each problem.

### pathParams

Each `:param` segment of the path becomes a string field of `pathParams`, by its name:

```typescript
export const handler = route("GET /v1/user/:userId", async ({ pathParams }) => {
  return { status: 200, data: await getUser(pathParams.userId) };
});
```

### headers

Each declared header is a field of `headers`, under the key it was declared with, not its HTTP
name. A required header is a `string` and an optional one is `string | undefined`. See
[Headers](/flex/domains/configuration/#headers).

## The handler result

A handler returns an object with a `status` and either `data`, `error` or neither. It can return
it directly or from a promise.

```typescript
// Success, with a JSON body
return { status: 200, data: { key: "value" } };

// Success, with no body
return { status: 204 };

// An error, as an ErrorResponse body
return { status: 404, error: { message: "Todo not found" } };
```

| Result | Response |
| --- | --- |
| `data` set | `data` as JSON, with `Content-Type: application/json`. `null` gives an empty body. |
| `error` set | An `ErrorResponse` body built from `error`. See [Returning an error](#returning-an-error). |
| Neither | An empty body. |

If the route has a `response` schema, `data` must match the schema's output type when the code
compiles.

Most handlers throw an error from [`http-errors`](https://github.com/jshttp/http-errors) instead
of returning one:

```typescript
import createHttpError from "http-errors";

if (!todo) throw new createHttpError.NotFound(`Todo not found: ${id}`);
if (!result.ok) throw new createHttpError.BadGateway();
```

## Response validation

When a route has a `response` schema and the result has `data`, the SDK validates `data` against
the schema. If it fails, the SDK:

- logs `Response validation failed` with the problems, adding the handler's result at `DEBUG` or
  `TRACE`
- emits a `response_validation_failed` telemetry event
- returns `500` instead of the handler's result

The `500` body is `Internal server error`. At `DEBUG` or `TRACE` it is
`Failed handler response validation`, with an `errors` entry for each problem.

Error results and results without `data` are not validated.

## Route context

`routeContext` reads the context of the route that is running, from anywhere in the code it
calls. This lets a service function use the logger, integrations or resources without being
passed them. Give it the route key, or a union of route keys, as a type argument:

```typescript
import { route, routeContext } from "@domain";
import createHttpError from "http-errors";

const context = routeContext<"GET /v1/users/me">;

export const handler = route("GET /v1/users/me", async ({ auth }) => {
  const notifications = await getNotifications(auth.pairwiseId);

  return { status: 200, data: { userId: auth.pairwiseId, notifications } };
});

async function getNotifications(userId: string) {
  const { integrations, logger } = context();

  const result = await integrations.udpGetNotificationPreferences({
    headers: { "requesting-service-user-id": userId },
  });

  if (!result.ok) {
    logger.error("Failed to get notification preferences", { status: result.error.status });
    throw new createHttpError.BadGateway();
  }

  return result.data;
}
```

A union of keys lets one service serve several routes. The example domain's `getIdentityLink`
uses `routeContext<"GET /v0/identity/:service" | "GET /v0/identity/:service [private]">` to serve
both the public and the private route.

The context is held in `AsyncLocalStorage` for the length of the handler. Calling `context()`
anywhere else, such as at the top level of a module, throws
`Route store is not available. Must be called within a route handler`.

To type a function that takes the context as an argument instead, use `InferRouteContext`:

```typescript
import type { InferRouteContext } from "@flex/sdk";
import type { config } from "@domain";

type VehicleContext = InferRouteContext<typeof config, "GET /v1/vehicle-enquiry/:reg">;
```

## Error responses

Every error that Flex returns to the app has the same JSON body, the `ErrorResponse` type in
`@flex/utils`:

```jsonc
{
  "message": "Invalid query parameters", // always present, safe to show
  "type": "validation_error", // auth_error | validation_error | client_error | server_error
  "errors": [
    // only for field-level problems
    { "field": "limit", "message": "Too big: expected number to be <=100" }
  ]
}
```

| `type` | Status | Returned when |
| --- | --- | --- |
| `auth_error` | `401`, `403` | Authentication or authorisation failed |
| `validation_error` | `400` | The request failed the route's headers, body or query schema |
| `client_error` | Other `4xx` | Anything else the client must fix, such as `404` |
| `server_error` | `5xx` | Something failed in Flex or behind it |

### Who returns which

| Source | Status | Body |
| --- | --- | --- |
| CloudFront Function: no bearer token shaped like a JWT | `401` | `{ "message": "Unauthorized", "type": "auth_error" }`, with an `x-rejected-by: cloudfront-function` header |
| API Gateway: the Lambda authorizer rejected the token | `401` or `403` | `{ "message": "Unauthorized", "type": "auth_error" }` |
| SDK: no pairwise id on a public route | `401` | `auth_error` |
| SDK: a required header is missing | `400` | `validation_error`, message `Missing headers: <names>`, an `errors` entry per header |
| SDK: the body failed its schema | `400` | `validation_error`, message `Invalid request body`, no `errors` |
| SDK: the query failed its schema | `400` | `validation_error`, message `Invalid query parameters`, an `errors` entry per problem |
| Handler: threw an `http-errors` error | Its status | `type` from the status. The error's message for `4xx`; `Internal server error` for `5xx`. |
| Handler: returned `{ status, error }` | `status` | `type` from the status. See below. |
| SDK: the response failed its schema | `500` | `server_error`. See [Response validation](#response-validation). |

Authentication failures return the same body whatever the reason, so the response cannot reveal
why a token was refused. A `5xx` from a thrown error never exposes its message: the detail is in
the logs. See [CloudFront Functions](/flex/edge/cloudfront-functions/) and
[Lambda authorizer](/flex/edge/authorizer/) for when those reject a request.

### Returning an error

When a handler returns `{ status, error }`, the SDK builds the body from `error`:

- a string becomes the `message`
- an object's `message` and `errors` are used, and its other fields are kept in the body
- anything else gets a default message: `Internal server error` for `5xx`, `Unauthorized` for
  `401` and `403`, or `Request failed`

The original `error` value is also kept in the body, under `error`. This field is deprecated and
will be removed. It exists for clients that read the older nested shape, such as DVLA's
`error.code`. Read the flat fields, such as `body.code` and `body.message`, not `body.error.*`.

### Responses outside the contract

A few responses do not have an `ErrorResponse` body:

- A `POST`, `PUT` or `PATCH` request without a JSON `Content-Type` gets `415` with the text body
  `Unsupported Media Type`, and malformed JSON gets `422`. Both come from the body-parsing
  middleware, before the SDK runs.
- An error the handler throws that is not an `http-errors` error, including an integration that
  fails at the network level, gets `500` with an empty body. The SDK logs it as
  `Unhandled error` and emits an `error_thrown` telemetry event.
- API Gateway's own responses, such as for a path no route matches, keep API Gateway's default
  body.
- Service gateways return `{ "message": "..." }` bodies without a `type`. A domain sees these only
  through an [integration result](/flex/domains/integrations/#the-integration-result), and decides
  what to return to the app.
