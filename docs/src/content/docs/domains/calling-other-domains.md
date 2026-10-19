---
title: Calling other domains and gateways
description: Declare an integration, call it, and handle what comes back.
sidebar:
  order: 4
---

A domain never calls another service directly. It declares an **integration**, and the SDK gives the handler a typed client for it. Every call goes through the private API Gateway, signed with SigV4, and IAM only allows the routes the integration declares.

## What you can call

| `type`      | Calls                                          | URL                                |
| ----------- | ---------------------------------------------- | ---------------------------------- |
| `"gateway"` | A service gateway, which wraps an external API | `/gateways/<target>/<version>/...` |
| `"domain"`  | Another domain's **private** route             | `/domains/<target>/<version>/...`  |

:::note
If no gateway has what you need, adding one is platform work. See [Current limits](/flex/start-here/current-limits/).
:::

### Calling a service gateway

Service gateways live in [`platform/domains/`](https://github.com/govuk-once/flex/tree/main/platform/domains). Each one lists its routes in its `gateway.config.ts`, so find the route you need there. If it isn't listed, the gateway doesn't support it yet, and adding it is platform work (see [Current limits](/flex/start-here/current-limits/)).

Declare the integration with `type: "gateway"` and the gateway's name as `target`:

```ts title="domain.config.ts"
integrations: {
  udpGetTopics: {
    type: "gateway",
    target: "udp",
    route: "GET /v1/topics",
    response: GetSelectedTopicsResponseSchema,
  },
},
```

Then call it from a handler:

```ts title="src/handlers/v1/topics/get.ts"
const result = await integrations.udpGetTopics({
  headers: { "requesting-service-user-id": auth.userId },
});
```

### Calling another domain's private route

A domain can only call another domain's **private** routes, never its public ones. If you need something from another domain, that domain has to expose it as a private route first.

Declare the integration with `type: "domain"` and the other domain's name as `target`. Write `route` without the `[private]` suffix:

```ts title="domain.config.ts"
integrations: {
  udpGetPushId: {
    type: "domain",
    target: "udp",
    route: "GET /v1/users/push-id",
    response: GetUserPushIdResponseSchema,
  },
},
```

The handler calls it in the same way as a gateway:

```ts title="src/handlers/v1/groups/get.ts"
const result = await integrations.udpGetPushId({
  headers: { "User-Id": auth.userId },
});
```

Leave out `target` to call a private route in your own domain.

:::note
Some names exist as both. `udp` is a service gateway (`platform/domains/udp`) and a domain (`domains/udp`) with its own private routes. Check which one has the route you need, and set `type` to match.
:::

## Declare it

An integration needs three things in `domain.config.ts`. The highlighted lines are numbered below:

```ts title="domain.config.ts" ins={"1":4-8} ins={"2":11-16} ins={"3":24-25}
export const { config, route, routeContext } = domain({
  name: "topics",
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
  },
  integrations: {
    udpGetTopics: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/topics",
      response: GetSelectedTopicsResponseSchema,
    },
  },
  routes: {
    v1: {
      "/topics": {
        GET: {
          public: {
            name: "retrieve-topics",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetTopics"],
          },
        },
      },
    },
  },
});
```

| Key | Purpose                                                        |
| --- | -------------------------------------------------------------- |
| `1` | The private gateway URL resource. Required for any integration |
| `2` | The integration itself                                         |
| `3` | Both listed on the route that makes the call                   |

### Notes

- The resource key can be any name, but the path must be `/flex/apigw/private/gateway-url`, and the route must list it. Otherwise every request to the route fails with a `500`.
- `target` is the gateway or domain name. Leave it out to call a private route in your own domain.
- `route` is the target's route, as `METHOD /version/path`, without the `[private]` suffix.
- `body` and `response` are Zod schemas. `body` types the call. `response` types `result.data` **and validates it** (see [Results](#results)).

All options are in the [Domain config reference](/flex/domains/domain-config/#integrations).

### Fixed and wildcard routes

| `route`              | IAM allows                              | Handler passes          |
| -------------------- | --------------------------------------- | ----------------------- |
| `GET /v1/topics`     | Exactly `GET /v1/topics`                | No path                 |
| `GET /v1/identity/*` | `GET` on anything under `/v1/identity/` | `path`, such as `/dvla` |

Use a wildcard to call a route with a path parameter. Don't write the parameter in the integration, such as `GET /v1/identity/:service`. Declare `GET /v1/identity/*` and pass the value in `path`.

## Call it

Integrations are on `integrations` in the handler context:

```ts title="src/handlers/v1/topics/get.ts"
export const handler = route(
  "GET /v1/topics",
  async ({ auth, integrations }) => {
    const result = await integrations.udpGetTopics({
      headers: { "requesting-service-user-id": auth.userId },
    });
    // ...
  },
);
```

| Option          | Description                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `body`          | Request body, for `POST`, `PUT` and `PATCH`. Typed from the integration's `body` schema. Sent as JSON. |
| `path`          | Wildcard routes only. Appended to the route, so start it with `/`.                                     |
| `headers`       | Request headers.                                                                                       |
| `query`         | Query parameters, as strings.                                                                          |
| `retryAttempts` | Overrides the integration's value for this call.                                                       |
| `maxRetryDelay` | Overrides the integration's value for this call.                                                       |

A wildcard route has no schemas, so pass the types as generics:

```ts
// GET: response type only
const result = await integrations.udpGetIdentity<IdentityLink>({
  path: `/${service}`,
  headers: { "User-Id": userId },
});

// POST, PUT, PATCH: request type, then response type
const result = await integrations.udpWrite<
  CreateUserRequest,
  CreateUserResponse
>({
  path: "/user",
  body,
});
```

### Passing the user

Private routes and gateways have no `auth`, so they can't tell who the user is unless you send it. Each target declares the header it expects, so look it up in the target's config. Today `udp` uses both:

- `requesting-service-user-id` on most routes
- `User-Id` on the identity routes

A missing required header gets a `400` from the target.

## Results

A call returns a result instead of throwing for an HTTP error:

```ts
type IntegrationResult<Data> =
  | { ok: true; status: number; data: Data }
  | { ok: false; error: { status: number; message: string; body?: unknown } };
```

| What happened                                       | Result                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `2xx`, and `data` matches `response` (or no schema) | `ok: true`                                                                                                            |
| `2xx`, but `data` doesn't match `response`          | `ok: false`, `status: 422`, `message: "Response validation failed"`. Emits `response_validation_failed`.              |
| `4xx` or `5xx`                                      | `ok: false`, the upstream `status`. `message` is the body's `message`, or the status text. `body` is the parsed body. |
| Network error or timeout, after any retries         | **Throws.** Not a result.                                                                                             |

Things to know:

- **A `422` may not be from upstream.** It's also what you get when the response doesn't match your schema. Check `error.message` to tell them apart.
- **A `204` fails a `response` schema.** The body is empty, so `data` is `undefined`. Don't set `response` on an integration to a route that returns `204`.
- **Network errors throw.** If you don't catch them, the caller gets a `500` with an empty body. See [Errors](/flex/domains/route-handlers/#errors).

## Handle upstream errors

Decide what each failure means to your caller, and throw an [`http-errors`](https://github.com/jshttp/http-errors) error for it. Don't pass the upstream body through.

```ts title="src/handlers/v1/topics/patch.ts" ins={"1":12-13} ins={"2":15-20} ins={"3":22-25}
import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "PATCH /v1/topics",
  async ({ auth, body, integrations, logger }) => {
    const result = await integrations.udpPostTopics({
      headers: { "requesting-service-user-id": auth.userId },
      body,
    });

    if (!result.ok) {
      const { status } = result.error;

      // A failure the caller can act on: map it to a meaningful status
      if (status === 409) {
        logger.warn("Update rejected because a newer version exists", {
          status,
        });

        throw new createHttpError.Conflict();
      }

      // Anything else is an upstream problem
      logger.error("Failed to update topics", { status });

      throw new createHttpError.BadGateway();
    }

    return { status: 204 };
  },
);
```

| Key | Purpose                                                            |
| --- | ------------------------------------------------------------------ |
| `1` | Check the result and read the upstream `status`, without the body  |
| `2` | A failure the caller can act on, mapped to a meaningful `4xx`      |
| `3` | Anything else is an upstream problem, so log it and return a `502` |

Use judgement about what each failure means to your caller:

- If the caller caused the failure or can act on it, return the matching `4xx` with a message that is safe to show.
- If the upstream outcome isn't a failure from your caller's point of view, such as "nothing found yet", consider a successful response instead.
- Otherwise, treat it as an upstream problem and return `502 Bad Gateway`.
- A network error is thrown, not returned. Catch it and throw a `502`, or let it become a `500`.

Log `status`, not `body`. The body comes from an external service and may contain personal data.

## Retries

Retries are off by default. Set `retryAttempts` on the integration, or on a single call:

```ts
udpGetTopics: {
  type: "gateway",
  target: "udp",
  route: "GET /v1/topics",
  retryAttempts: 2,
  maxRetryDelay: 500,
},
```

- **Only network errors are retried.** A `5xx` or `429` response is returned straight away, not retried.
- `retryAttempts` is the number of retries after the first try, up to `5`.
- Waits use exponential backoff with full jitter. `maxRetryDelay` caps each wait in milliseconds, between `10` and `1000`. The default cap is `1000`.
- Each retry logs a warning and emits `third_party_request_retried`.

There is no timeout per call. A request that hangs runs until the Lambda's `timeoutSeconds`.

Only retry calls that are safe to repeat. A `POST` that timed out may already have succeeded upstream.

## Checks before deploy

- **TypeScript** checks that a route only lists integrations that exist, and types the call from the schemas.
- **`pnpm validate:integrations`**, run in CI, checks that every `type: "domain"` integration matches a private route in its target domain. It doesn't check `type: "gateway"` integrations. Check those against the gateway's `gateway.config.ts` yourself.
- **IAM** is generated from the integration's `route`, so a call to a path or method that isn't declared gets a `403` from the private API Gateway.

## Testing

Use the `http` fixture to stub calls in unit tests: `http.gateway("udp")` or `http.domain("udp")`. See [Testing](/flex/domains/testing/).
