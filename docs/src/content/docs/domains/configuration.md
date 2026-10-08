---
title: Configuration
description: The domain() reference, covering routes, route keys, versions, exposure, access, function options, feature flags and headers.
---

Every domain has a `domain.config.ts` at its root. It calls `domain()` from `@flex/sdk` once and
exports what it returns:

```typescript
import { domain } from "@flex/sdk";

export const { config, route, routeContext } = domain({
  // ...
});
```

| Export | What it is |
| --- | --- |
| `config` | The configuration object. The CDK app and the OpenAPI generator read it. |
| `route` | Creates a route's Lambda handler. See [Handlers](/flex/domains/handlers/). |
| `routeContext` | Reads a route's context outside the handler function. See [Handlers](/flex/domains/handlers/#route-context). |

The configuration is typed with `const` inference, so resource, integration and feature flag keys,
environments and route keys are all checked when the code compiles. The CDK app checks it again
against a Zod schema when it synthesizes.

## A complete example

```typescript
import { domain } from "@flex/sdk";

import {
  CreateUserRequestSchema,
  GetUserResponseSchema,
} from "./src/schemas";

export const { config, route, routeContext } = domain({
  name: "my-domain",
  environments: ["development", "staging"],
  common: {
    access: "isolated",
    function: { timeoutSeconds: 30 },
  },
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
    notificationSecret: {
      type: "secret",
      path: "/flex-secret/udp/notification-hash-secret",
    },
  },
  integrations: {
    udpGetIdentity: { type: "gateway", target: "udp", route: "GET /v1/identity/*" },
  },
  featureFlags: {
    newProfile: { description: "Return the new profile shape", environments: ["development"] },
  },
  routes: {
    v1: {
      "/user": {
        GET: {
          public: {
            name: "get-user",
            resources: ["privateGatewayUrl", "notificationSecret"],
            integrations: ["udpGetIdentity"],
            featureFlags: ["newProfile"],
            response: GetUserResponseSchema,
          },
        },
        POST: {
          private: {
            name: "create-user",
            body: CreateUserRequestSchema,
            headers: { userId: { name: "User-Id" } },
          },
        },
      },
    },
  },
});
```

## Domain fields

| Field | Required | What it does |
| --- | --- | --- |
| `name` | Yes | The domain's name. It is the first segment of every route's URL, part of every Lambda function's name, and must match the directory name. |
| `routes` | Yes | The routes, by version, path and method. See [Routes](#routes). |
| `environments` | No | The persistent environments the domain deploys to. See [Environments](#environments). |
| `common` | No | Defaults for every route. See [Common defaults](#common-defaults). |
| `resources` | No | SSM parameters, secrets and KMS keys. See [Resources](/flex/domains/resources/). |
| `integrations` | No | Calls to other domains and service gateways. See [Integrations](/flex/domains/integrations/). |
| `featureFlags` | No | Boolean flags. See [Feature flags](#feature-flags). |
| `owner` | No | Sets the `Owner` tag on the domain's stack. Without it the tag is `N/A`. |

Resources, integrations and feature flags are declared once for the domain, then named by each
route that uses them. A route gets only what it names.

## Environments

`environments` lists the persistent environments the domain deploys to: any of `development`,
`staging` and `production`. A route can narrow it further with its own `environments`, which may
only name environments the domain lists.

| Stage | What deploys |
| --- | --- |
| `development`, `staging`, `production` | The domain only if `environments` includes the stage, or is left out. Within it, only the routes whose own `environments` include the stage, or leave it out. If no route is left, the domain has no stack. |
| A personal or PR stage | Every route of every domain, whatever `environments` says. |

Leaving `environments` out deploys the domain everywhere, production included. Every domain in
the repository sets it, and a new domain should too. E2E tests use `isDomainDeployed` and
`isRouteDeployed` from `@flex/sdk` to skip what the target stage does not have. See
[Testing](/flex/domains/testing/#module-e2e-tests).

## Common defaults

`common` sets defaults for every route. A value on the route wins.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `access` | `"public"`, `"private"` or `"isolated"` | `"isolated"` | The network the Lambda function runs in. See [Access](#access). |
| `logLevel` | `LogLevel` | `"INFO"` | The log level. See [Log level](#log-level). |
| `function` | `FunctionConfig` | none | Lambda options. See [Function options](#function-options). |
| `headers` | `Record<string, HeaderConfig>` | none | Headers every route reads. See [Headers](#headers). |

## Routes

`routes` nests the version, the path and the method, then says whether the method is public,
private or both. Each of `public` and `private` holds a route configuration. At least one must be
set.

```typescript
routes: {
  v1: {                       // version
    "/todos/:id": {           // path, with :param segments
      GET: {                  // GET, POST, PUT, PATCH, DELETE, HEAD or OPTIONS
        public: { name: "get-todo" },
        private: { name: "get-todo", headers: { userId: { name: "User-Id" } } },
      },
    },
  },
},
```

### Route options

| Option | Type | Description |
| --- | --- | --- |
| `name` | `string` | Required. Forms the function's CDK id and its log service name, both `<domain>-<public or private>-<version>-<name>`, and is the OpenAPI `operationId`. It must be unique within a version and exposure. |
| `access` | `"public"`, `"private"` or `"isolated"` | Overrides `common.access`. |
| `function` | `FunctionConfig` | Overrides `common.function`. |
| `logLevel` | `LogLevel` | Overrides `common.logLevel`. |
| `body` | Zod schema | The request body. Only allowed on `POST`, `PUT` and `PATCH`. |
| `query` | Zod schema | The query string parameters. |
| `response` | Zod schema | The response `data`. See [Response validation](/flex/domains/handlers/#response-validation). |
| `resources` | resource keys | The resources the handler reads. |
| `integrations` | integration keys | The integrations the handler calls. |
| `featureFlags` | flag keys | The flags the handler reads. |
| `headers` | `Record<string, HeaderConfig>` | Headers the handler reads, merged with `common.headers`. |
| `environments` | environments | Narrows the domain's `environments` for this route. |

Schemas drive validation, the handler's types and the OpenAPI document.

### Versions

The top-level key, such as `v1`, is the version. It is the second segment of the URL and the first
directory under `src/handlers/`. Versions are independent: `v1` and `v2` of the same path are
different routes with different Lambda functions, so a breaking change can ship as a new version
while the old one keeps serving.

### Public and private routes

|  | `public` | `private` |
| --- | --- | --- |
| Called by | The GOV.UK app | Other domains, through an [integration](/flex/domains/integrations/) |
| URL | `/app/<domain>/<version>/<path>` on the public API | `/domains/<domain>/<version>/<path>` on the private API |
| Authorisation | The Lambda authorizer checks the user's token | IAM: the caller must be granted the route |
| User identity | `auth.pairwiseId` | None. Declare a header, such as `User-Id`, for the caller to send. |
| Handler file | `<method>.ts` | `<method>.private.ts` |

Declaring both creates two Lambda functions with separate configuration. The example and UDP
domains do this for `GET /identity/:service`.

## Route keys

A route key names one route. Its form is the method, a space, and the versioned path, with
` [private]` on the end for the private route:

| Form | Example |
| --- | --- |
| `METHOD /version/path` | `"GET /v1/user"` |
| `METHOD /version/path [private]` | `"POST /v1/user [private]"` |

Path parameters keep their `:param` form, as in `"GET /v1/user/:userId"`. Only routes in the
configuration are valid keys, and the compiler rejects any other string. Route keys are what you
pass to `route()`, `routeContext`, `InferRouteContext` and `isRouteDeployed`.

## Access

`access` chooses the network the route's Lambda function runs in. It is separate from whether the
route is public or private.

| Value | Network |
| --- | --- |
| `"isolated"` | In the VPC, with no route to the internet. The default. |
| `"private"` | In the VPC, with internet access through NAT. |
| `"public"` | Outside the VPC. |

Integrations reach the private API through a VPC endpoint, so an `isolated` function can call
them, while a `public` one cannot. Choose `isolated` unless the handler itself must call the wider
internet, and then choose `private`. No domain uses `public`. What each value creates is in
[Lambda constructs](/flex/infrastructure/lambda-constructs/).

## Function options

`function` sets Lambda options. A route's `function` overrides `common.function` field by field,
and their `environment` maps are merged, the route's values winning.

| Option | Range | Default |
| --- | --- | --- |
| `timeoutSeconds` | 1 to 900 | 15 |
| `memorySize` | 128 to 10240 MB | 128 MB. In staging and production, `private` and `isolated` functions get 1024 MB unless this is set. |
| `environment` | `Record<string, string>` | none |

`environment` holds plain environment variables. They are encrypted at rest, but they are visible
to anyone who can read the function's configuration, so never put a secret in one. Use a
[resource](/flex/domains/resources/) instead.

## Log level

`logLevel` is one of `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT` or `CRITICAL`, and
defaults to `INFO`. At `DEBUG` or `TRACE`, the SDK also logs each incoming event, and a failed
response validation returns its details in the response body. In production the logger ignores
the setting (see [Logging](/flex/observability/logging/)), but the SDK still returns those
details, so do not set `DEBUG` or `TRACE` on a route that reaches production.

## Feature flags

A feature flag is a boolean a handler reads from `featureFlags` in its context. Declare it once
for the domain, then name it on each route that reads it.

```typescript
featureFlags: {
  enableTodoMetadata: {
    description: "Include metadata in todo responses",
    default: false,
    environments: ["development"],
  },
},
```

| Field | Description |
| --- | --- |
| `description` | What the flag controls. |
| `environments` | The environments where the flag is on. |
| `default` | The value everywhere else. Defaults to `false`. |

The SDK works out each flag on every request, taking the first of:

1. an environment variable named after the flag key, set to `"true"` or `"false"`, for example
   through `function.environment`
2. `true`, if the current environment is in `environments`
3. `default`
4. `false`

The current environment comes from `STAGE`. A personal or PR stage counts as `development`.

## Headers

Headers can be declared in `common.headers`, for every route, or on a route. The two are merged by
key, the route winning. Each key becomes a field of `headers` in the handler's context.

```typescript
common: {
  headers: {
    traceId: { name: "x-trace-id", required: false },
  },
},
// on a route:
headers: {
  userId: { name: "User-Id" },
},
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | none | The HTTP header name. Matching ignores case. |
| `required` | `boolean` | `true` | Whether the request must send it. |

A required header that is missing or empty fails the request with `400` and a
`validation_error` listing every missing header. An optional header is `string | undefined` in the
handler. Declaring `Authorization` gives the handler the user's raw bearer token, which UDP's
`POST /v1/identity/:service` uses. Declared headers appear as parameters in the OpenAPI document.
