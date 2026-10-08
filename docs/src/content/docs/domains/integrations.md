---
title: Integrations
description: How a domain calls another domain's private routes or a service gateway, what a call returns, retries, response validation and the CI check.
---

An integration is a typed client for one route on the private API. A handler calls it to reach
another domain's private route, one of its own domain's private routes, or a
[service gateway](/flex/gateways/overview/). The SDK signs every call with SigV4, and the platform
grants each Lambda function `execute-api:Invoke` on exactly the routes its integrations name.

## Declaring an integration

Declare integrations once for the domain, then name them on each route that calls them:

```typescript
export const { config, route } = domain({
  name: "example",
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
  },
  integrations: {
    udpGetPushId: {
      type: "domain",
      target: "udp",
      route: "GET /v1/users/push-id",
      response: GetUserPushIdResponseSchema,
    },
    udpGetIdentity: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/identity/*",
    },
  },
  routes: {
    v0: {
      "/identity/:service": {
        GET: {
          public: {
            name: "get-identity-link",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetIdentity"],
          },
        },
      },
    },
  },
});
```

Every route that names an integration must also name the private gateway URL resource. See
[The private gateway URL](/flex/domains/resources/#the-private-gateway-url).

| Option | Description |
| --- | --- |
| `type` | `"domain"` or `"gateway"`. See [Integration types](#integration-types). |
| `route` | The method and versioned path to call, such as `"GET /v1/users/push-id"`. A path ending `/*` is a [wildcard](#wildcard-routes). |
| `target` | The domain or gateway to call. Defaults to this domain's `name`. |
| `body` | A Zod schema that types the request body. It is not checked at run time. |
| `response` | A Zod schema the response body is validated against, which also types `data`. |
| `retryAttempts` | How many times to retry a request that fails to complete, from 0 to 5. Defaults to 0. |
| `maxRetryDelay` | The longest wait between retries, in milliseconds, from 10 to 1000. Defaults to 1000. |

## Integration types

| Type | Calls | URL on the private API |
| --- | --- | --- |
| `domain` | A private route of a domain | `/domains/<target>/<version>/<path>` |
| `gateway` | A route of a service gateway | `/gateways/<target>/<version>/<path>` |

A `domain` integration must point at a route the target declares as `private`; public routes are
not on the private API. A domain can call its own private routes by leaving out `target`, as the
example domain's `duplicate-todo` route does. The gateways and their routes are listed in
[Service gateways](/flex/gateways/catalogue/).

## Wildcard routes

A route ending `/*`, such as `"GET /v1/identity/*"`, covers every path under that prefix. The
handler supplies the rest of the path on each call, and the permission granted covers the whole
prefix. Both types support wildcards.

Use a wildcard when the path holds a value, such as an id. A route without one calls exactly one
path, and its `path` option is ignored.

## Calling an integration

Each integration the route names is a function on `integrations`. It takes one options object and
returns a promise of an [integration result](#the-integration-result).

```typescript
// A fixed route: the body and data are typed from the integration's schemas
const result = await integrations.udpGetPushId({
  headers: { "User-Id": userId },
});

// A wildcard route: `path` is appended to the route's prefix
const link = await integrations.udpGetIdentity<GetServiceIdentityLinkResponse>({
  path: `/${service}`,
  headers: { "User-Id": userId },
});

// A wildcard route with a body: type the request, then the response
const created = await integrations.udpCreateIdentity<CreateLinkRequest, CreateLinkResponse>({
  path: `/${service}/${serviceId}`,
  body: { /* ... */ },
});
```

| Option | Applies to | Description |
| --- | --- | --- |
| `path` | Wildcard routes, required | Appended to the route's path, after the `/*` is removed |
| `body` | `POST`, `PUT` and `PATCH`, required | Sent as JSON, with `Content-Type: application/json` |
| `headers` | All | Request headers |
| `query` | All | Query string parameters, as strings |
| `retryAttempts`, `maxRetryDelay` | All | Override the integration's values for this call |

For a wildcard route, the type arguments set the request and response types. Without them, `data`
takes the type of the integration's `response` schema, or `unknown`.

## The integration result

An integration call returns a result instead of throwing for an HTTP error:

```typescript
// The target answered with a 2xx status, and the body passed any response schema
{ ok: true, status: 200, data: { /* the parsed body */ } }

// The target answered with any other status, or the body failed the response schema
{ ok: false, error: { status: 404, message: "Not found", body: { /* the parsed body */ } } }
```

| Case | `ok` | `status` | `message` | `body` |
| --- | --- | --- | --- | --- |
| A `2xx` that passes the schema | `true` | The response's | | `data` holds the body |
| Any other status | `false` | The response's | The body's `message`, or the status text | The parsed body |
| A `2xx` that fails the schema | `false` | `422` | `Response validation failed` | The validation problems |

The handler decides what each failure means to the app. Most map a `404` to their own `404` or an
empty result, and anything else to `502`:

```typescript
const result = await integrations.udpGetTopics({
  headers: { "requesting-service-user-id": userId },
});

if (!result.ok) {
  if (result.error.status === 404) {
    return { status: 200, data: { topics: { selectedTopics: [] } } };
  }

  logger.error("Failed to get user topics", { status: result.error.status });
  throw new createHttpError.BadGateway();
}

return { status: 200, data: result.data };
```

A request that cannot complete at all, such as one that hits a network error, throws once its
retries are used up. Unless the handler catches it, the route returns `500`. See
[Responses outside the contract](/flex/domains/handlers/#responses-outside-the-contract).

## Retries

Retries are off unless `retryAttempts` is set. They apply only to requests that fail to complete.
A response with an error status, `5xx` included, is returned at once as a failed result and is
never retried. Between attempts the SDK waits an exponential backoff with full jitter, capped at
`maxRetryDelay`. Each retry logs a warning and emits a `third_party_request_retried` telemetry
event.

A retry repeats the request, so only retry calls that are safe to repeat.

## Response validation

With a `response` schema, the SDK validates the body of every `2xx` response. A body that fails
becomes a failed result with status `422`, and the SDK emits a `response_validation_failed`
telemetry event. Without a schema, `data` is the parsed body, unchecked.

## Correlation id

The SDK adds an `x-correlation-id` header to an integration's request when the route has declared
a header whose key is `x-correlation-id`. The key is what counts, not the header's `name`. Declare
it like this to pass the incoming correlation id on:

```typescript
headers: {
  "x-correlation-id": { name: "x-correlation-id", required: false },
},
```

## The integration check in CI

`pnpm validate:integrations` loads every domain's configuration and checks that each `domain`
integration has a target domain that exists, and a private route in it that matches the method,
version and path. A path parameter in the target matches any segment, and a wildcard matches any
longer path. It reports each integration that does not resolve, for example because the target
route was removed or made public only, and fails.

The quality checks run it on every pull request and on `main`. It does not check `gateway`
integrations: a call to a route the gateway does not have fails at run time.
