---
title: Domain config reference
description: Every option in domain.config.ts.
sidebar:
  order: 2
---

Every domain has a `domain.config.ts` at its root. It calls `domain()` from [`@flex/sdk`](https://github.com/govuk-once/flex/tree/main/libs/sdk) once and exports the result:

```ts title="domains/topics/domain.config.ts"
import { domain } from "@flex/sdk";

export const { config, route, routeContext } = domain({
  name: "topics",
  environments: ["development", "staging"],
  common: { access: "isolated", function: { timeoutSeconds: 20 } },
  resources: {
    /* ... */
  },
  integrations: {
    /* ... */
  },
  routes: {
    /* ... */
  },
});
```

| Export         | Used by                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `config`       | The platform, to build infrastructure, and the OpenAPI generator                                           |
| `route`        | Handler files. See [Writing route handlers](/flex/domains/route-handlers/)                                 |
| `routeContext` | Helpers that need the current route's context. See [Writing route handlers](/flex/domains/route-handlers/) |

The config is validated against [`DomainConfigSchema`](https://github.com/govuk-once/flex/blob/main/libs/sdk/src/config/schema.ts) at deploy time, and TypeScript checks every cross-reference, such as a route naming a resource that doesn't exist.

## Top level

| Field          | Required | Description                                                                                                                                  |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | Yes      | The domain name. Used in URLs (`/app/<name>/...`) and resource names.                                                                        |
| `routes`       | Yes      | The endpoints this domain exposes, nested by version, path and method. See [Routes](#routes).                                                |
| `environments` | No       | Persistent environments to deploy to: `development`, `staging`, `production`. Defaults to all three. Personal and `pr-<n>` stages ignore it. |
| `common`       | No       | Defaults shared by every route, such as network placement and timeouts. See [Common](#common).                                               |
| `resources`    | No       | SSM parameters, secrets and KMS keys the platform looks up and injects. See [Resources](#resources).                                         |
| `integrations` | No       | Typed clients for calling service gateways and other domains. See [Integrations](#integrations).                                             |
| `featureFlags` | No       | Flags that routes can read at runtime. See [Feature flags](/flex/domains/feature-flags/).                                                    |
| `owner`        | No       | Owning team, for reference.                                                                                                                  |

## Routes

Routes nest by version, path, method and then `public` or `private`. Each method needs at least one of the two.

```ts
routes: {
  v1: {
    "/topics": {
      GET: {
        public: { name: "retrieve-topics", response: GetTopicsResponseSchema },
      },
    },
    "/topics/:id": {
      PATCH: {
        private: { name: "update-topic", body: UpdateTopicRequestSchema },
      },
    },
  },
},
```

`:param` segments become `pathParams` in the handler. The handler file goes at `src/handlers/<version>/<path>/<method>[.private].ts`, with `:param` written as `[param]`.

### Route options

| Field          | Description                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | Required. Short name, unique in the domain. Used in the log service name (`<domain>-<gateway>-<version>-<name>`).                                             |
| `body`         | Zod schema for the request body. `POST`, `PUT` and `PATCH` only. An invalid body gets a `4xx` (see [The context](/flex/domains/route-handlers/#the-context)). |
| `query`        | Zod schema for query parameters. Invalid parameters get a `400`.                                                                                              |
| `response`     | Zod schema for the response `data`. A response that doesn't match gets a `500`.                                                                               |
| `headers`      | Headers the route reads. See [Headers](#headers).                                                                                                             |
| `resources`    | Keys from `resources` the route needs. Only these are granted and injected.                                                                                   |
| `integrations` | Keys from `integrations` the route calls. Only these are granted and injected.                                                                                |
| `featureFlags` | Keys from `featureFlags` the route reads.                                                                                                                     |
| `environments` | Narrows the domain's `environments` for this route.                                                                                                           |
| `access`       | Overrides `common.access`.                                                                                                                                    |
| `logLevel`     | Overrides `common.logLevel`.                                                                                                                                  |
| `function`     | Overrides `common.function`.                                                                                                                                  |

The `body`, `query` and `response` schemas also generate the domain's OpenAPI spec. Tag shared schemas with `.meta({ id: "PascalCaseName" })` so they appear once under `components.schemas` instead of inline.

## Common

Defaults for every route. A value set on a route takes precedence.

| Field      | Default      | Description                                                                |
| ---------- | ------------ | -------------------------------------------------------------------------- |
| `access`   | `"isolated"` | Lambda network placement. See [Access](#access).                           |
| `logLevel` | `"INFO"`     | Log level. Ignored in `production`.                                        |
| `function` | —            | Lambda options. See [Function](#function).                                 |
| `headers`  | —            | Headers every route reads. Merged with route `headers`, the route winning. |

### Access

`access` decides what the route's Lambda can call out to. It has nothing to do with who can call the route; that is `public` or `private`. See [Who can call a route, and what it can call](/flex/domains/overview/#who-can-call-a-route-and-what-it-can-call).

| Value        | Lambda                        | Integrations | AWS services | Internet | Use when                               |
| ------------ | ----------------------------- | ------------ | ------------ | -------- | -------------------------------------- |
| `"isolated"` | `FlexPrivateIsolatedFunction` | Yes          | Yes          | No       | Default. Almost every domain.          |
| `"private"`  | `FlexPrivateEgressFunction`   | Yes          | Yes          | Via NAT  | The handler itself calls the internet. |
| `"public"`   | `FlexPublicFunction`          | **No**       | Yes          | Yes      | Almost never. Can't use integrations.  |

`"isolated"` and `"private"` Lambdas run in the VPC and reach the private API Gateway, SSM, Secrets Manager and KMS through VPC endpoints. A `"public"` Lambda runs outside the VPC, and the private API Gateway rejects anything that doesn't arrive through its VPC endpoint. External services belong behind a service gateway, not in a domain handler.

### Function

| Field            | Range        | Description                  |
| ---------------- | ------------ | ---------------------------- |
| `timeoutSeconds` | 1 to 900     | Lambda timeout.              |
| `memorySize`     | 128 to 10240 | Lambda memory in MB.         |
| `environment`    | —            | Extra environment variables. |

## Resources

Values the platform looks up and injects. Declare them once on the domain, then list them on the routes that need them. The key becomes the Lambda environment variable name and the property name in the handler's `resources`.

```ts
resources: {
  privateGatewayUrl: {
    type: "ssm",
    path: "/flex/apigw/private/gateway-url",
    scope: "stage",
  },
  apiKey: { type: "secret", path: "/flex-secret/<domain>/example-api-key" },
  encryptionKeyArn: { type: "kms", path: "/flex-secret/encryption-key" },
},
```

### The private gateway URL

Any domain with `integrations` must declare a resource with the path `/flex/apigw/private/gateway-url` and `scope: "stage"`, as `privateGatewayUrl` does above. Every call to a gateway or another domain goes through this URL. The key can be any name, because the platform finds the resource by its path.

Without it, the integration setup throws `"/flex/apigw/private/gateway-url" resource was not found` when the Lambda starts.

| Type            | Source              | Resolved                  | Handler gets        |
| --------------- | ------------------- | ------------------------- | ------------------- |
| `"ssm"`         | SSM Parameter Store | At deploy                 | The parameter value |
| `"ssm:runtime"` | SSM Parameter Store | At runtime, by middleware | The parameter value |
| `"secret"`      | Secrets Manager     | At runtime, by middleware | The secret value    |
| `"kms"`         | KMS key alias       | At deploy                 | The key ARN         |

Deploy-time values are baked into the Lambda environment, so a change needs a redeploy. Runtime values are fetched by the handler middleware, and only the name is stored in the environment.

### Paths and scope

The platform prefixes `path` with the environment it is deploying to. Set `scope: "stage"` to prefix it with the stage name instead, for values that exist once per stage, such as the private gateway URL.

| `scope`                   | Deployed to                       | Resolved path           |
| ------------------------- | --------------------------------- | ----------------------- |
| `"environment"` (default) | `development`, personal, `pr-<n>` | `/development/flex/...` |
| `"environment"` (default) | `staging`                         | `/staging/flex/...`     |
| `"stage"`                 | Any                               | `/<stage>/flex/...`     |

`scope` has no effect on `kms`.

## Integrations

Typed clients for calling service gateways and other domains' private routes. All calls go through the private API Gateway, signed with SigV4.

:::caution
The domain must declare the [private gateway URL](#the-private-gateway-url) as a resource, or its integrations fail at runtime.
:::

```ts
integrations: {
  udpGetTopics: {
    type: "gateway",
    target: "udp",
    route: "GET /v1/topics",
    response: GetSelectedTopicsResponseSchema,
  },
  udpGetIdentity: { type: "gateway", target: "udp", route: "GET /v1/identity/*" },
},
```

| Field           | Description                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `type`          | `"gateway"` for a service gateway (`/gateways/<target>/...`), `"domain"` for a domain's private route (`/domains/<target>/...`). |
| `target`        | The gateway or domain name. Defaults to this domain.                                                                             |
| `route`         | `METHOD /version/path`. End with `/*` to allow any path below it, which the handler then supplies.                               |
| `body`          | Request body schema, which types the call. For a `/*` route, pass the type as a generic when calling instead.                    |
| `response`      | Response schema, which types `result.data`.                                                                                      |
| `retryAttempts` | Retries on a failed request.                                                                                                     |
| `maxRetryDelay` | Longest wait between retries.                                                                                                    |

IAM grants the route exactly the method and path declared. See [Calling other domains and gateways](/flex/domains/calling-other-domains/) for how to call them and handle errors.

## Headers

Named request headers a route reads. They appear under `headers` in the handler, keyed by the name you give them.

```ts
headers: {
  userId: { name: "requesting-service-user-id" },
  traceId: { name: "x-trace-id", required: false },
},
```

| Field      | Default | Description                                                                                                       |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `name`     | —       | The HTTP header name. Case-insensitive.                                                                           |
| `required` | `true`  | A missing required header gets a `400` that lists every missing name. Optional headers are `string \| undefined`. |

## Feature flags

See [Feature flags](/flex/domains/feature-flags/).
