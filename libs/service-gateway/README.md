# @flex/service-gateway

Declarative gateway configuration for the FLEX platform. Handles route handler creation, AWS resource resolution, communication with remote third-party APIs via clients and automated CDK infrastructure generated from a single configuration file.

---

## Commands

Run these from the repository root:

| Command                                             | Description                            |
| --------------------------------------------------- | -------------------------------------- |
| `pnpm --filter @flex/service-gateway lint`          | Lint files                             |
| `pnpm --filter @flex/service-gateway test`          | Run tests                              |
| `pnpm --filter @flex/service-gateway test:coverage` | Run tests and generate coverage report |
| `pnpm --filter @flex/service-gateway tsc`           | Run type check                         |

Alternatively, run `pnpm <command>` from within `libs/service-gateway/`.

## API

| Name                               | Description                                             | Code                                                     |
| ---------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| [`defineGateway`](#definegateway)  | Gateway configuration and route handler factory         | [View](/libs/service-gateway/src/config/gateway.ts)      |
| [`createRestClient`](#rest-client) | REST client factory for outbound calls to a remote API  | [View](/libs/service-gateway/src/client/adapter/rest.ts) |
| [`mapApiResult`](#mapapiresult)    | Transforms a remote payload into the gateway's contract | [View](/libs/service-gateway/src/utils/result.ts)        |

---

## `defineGateway`

Creates the gateway configuration and exposes a factory for building the gateway's Lambda handler and its routes.

> `defineGateway` should only be called once in `gateway.config.ts` at the workspace root, and will expose the functionality needed for building the Lambda handler and provisioning the necessary infrastructure.

### Usage

#### Gateway

```typescript
import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { ExampleSchema } from "./src/schemas/domain/example";

export const { config, createHandler } = defineGateway({
  name: "example",
  environments: ["development", "staging", "production"],
  access: "private",
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/example/consumer-config-secret-arn",
      env: "FLEX_EXAMPLE_CONSUMER_CONFIG_SECRET_ARN",
      config: z.object({
        apiKey: NonEmptyString,
        apiUrl: NonEmptyString,
        // ...
      }),
    },
  },
  routes: {
    "GET /v1/example/:id": {
      name: "getExample",
      query: z.object({ queryKey: NonEmptyString }),
      headers: {
        auth: { name: "x-custom-token", required: true },
      },
      response: ExampleSchema,
    },
  },
});
```

#### Gateway Handler

```typescript
import { createRestClient } from "@flex/service-gateway";

import { createHandler } from "../gateway.config";

export const handler = createHandler({
  clients: ({ consumerConfig }) => ({
    api: createRestClient({
      baseUrl: consumerConfig.apiUrl,
      auth: { type: "public" },
    }),
  }),
  routes: {
    "GET /v1/example/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
      queryParams: { queryKey },
    }) => {
      return api.get(`/remote/example/${id}`, {
        headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
        query: { queryKey },
      });
    },
  },
});
```

> Gateway configuration (`config`) is imported by `@platform/flex`, so `gateway.config.ts` must not import runtime-only code.

### API

| Property        | Type                           | Description                                     |
| --------------- | ------------------------------ | ----------------------------------------------- |
| `config`        | `Config extends GatewayConfig` | Gateway configuration for CDK consumption       |
| `createHandler` | `(input) => GatewayLambda`     | Handler factory for creating the Lambda handler |

`createHandler` takes `clients`, a factory receiving the resolved resources and returning the client map, and `routes`, which must provide a handler for every route key declared in the gateway configuration.

### Configuration

| Property       | Type                      | Description                                                                                           |
| -------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `name`         | `string`                  | Identifies the gateway for routing, logging and infrastructure                                        |
| `environments` | `readonly Environment[]`  | Environments the gateway is deployed to                                                               |
| `access`       | `"private" \| "isolated"` | Specify network access for the gateway: `"private"` for external APIs, `"isolated"` for internal only |
| `resources`    | `ResourceMap`             | Defines AWS values to provision/inject at deploy or runtime, see [Resources](#resources)              |
| `function`     | `GatewayFunctionConfig`   | Optional Lambda function overrides (e.g. alarms)                                                      |
| `routes`       | `GatewayRouteMap`         | Route definitions, keyed as `"METHOD /path"`                                                          |

### Route Key

Route keys identify which endpoint a handler will serve. Only routes defined in the gateway configuration will be available as a valid route key:

| Format                   | Example                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `"METHOD /version/path"` | `"GET /v1/example"`, `"GET /v1/example/:id"`, `"GET /v1/example/:id/other"` |

Unlike [`@flex/sdk`](/libs/sdk/README.md#route-key), gateway route keys do not specify an access suffix. That suffix only exists in the SDK as a domain could define a public and private handler using an identical route key where a route is needed for either access pattern. Gateways on the other hand don't need this flexibility since access is declared once for the whole gateway.

### Route Configuration

| Property   | Type                           | Description                                                       |
| ---------- | ------------------------------ | ----------------------------------------------------------------- |
| `name`     | `string`                       | Operation name to use for infrastructure purposes                 |
| `query`    | `z.ZodType`                    | Query parameter schema                                            |
| `headers`  | `Record<string, HeaderConfig>` | Headers to extract, keyed by the name used in the handler context |
| `body`     | `z.ZodType`                    | Request body schema                                               |
| `response` | `z.ZodType`                    | Response schema validated before the response is returned         |

### Handler Context

The context object passed to the handler is scoped to the route definition. Only known properties defined for that route are included:

| Property      | Condition                                          |
| ------------- | -------------------------------------------------- |
| `logger`      | All handlers                                       |
| `clients`     | All handlers                                       |
| `resources`   | All handlers                                       |
| `body`        | Included when the route declares a `body` schema   |
| `queryParams` | Included when the route declares a `query` schema  |
| `pathParams`  | Included when the path contains a `:param` segment |
| `headers`     | Included when the route declares a header          |

See [Service Gateway Development](/docs/platform-development.md#service-gateway-development) for examples of each context property.

### Handler Result

Handlers return an `ApiResult`, the same shape returned by a client operation, so a route that proxies a remote call can return the client result directly. The gateway handles the transformation to an API Gateway proxy result:

```typescript
// Success result
return {
  ok: true,
  status: 200,
  data: { key: "value" },
};

// Error result
return {
  ok: false,
  error: { status: 404, message: "some error message" },
};
```

Handlers can also throw from `http-errors` for standard error responses.

### Request Validation

Path parameters, headers, query parameters and body are resolved before the handler runs. A failure returns an automatic 400 error that includes a list of missing header names and invalid query parameters. A request matching no route key, or a route key with no handler, returns a 404 (`type: "client_error"`).

### Response Validation

When a route defines a `response` schema, the gateway validates the handler's response `data` against it. Validation errors are logged and return a 502 error response, since a remote response that no longer matches the expected contract is an upstream error rather than a client error.

### Remote Error Mapping

Failed results are mapped so client-class faults stay attributable to the caller and upstream faults collapse to a single code:

| Remote status | Gateway status | Body                                                        |
| ------------- | -------------- | ----------------------------------------------------------- |
| `4xx`         | Unchanged      | Flattened error response, plus the remote body when present |
| `5xx`         | `502`          | `server_error` with an upstream unavailable message         |

> Where the remote body is forwarded, it is also nested under a top-level `error` key. That field is **deprecated** and will be removed in a follow-up. Read the flat fields (`body.message`, `body.code`), not `body.error.*`.

---

## Resources

Declare AWS-managed values that the platform provisions and injects into the Lambda environment. Resources are declared once at the gateway level and are accessible within any route handler.

> Resource declarations follow the same model as [`@flex/sdk`](/libs/sdk/README.md#resources) and are granted IAM permissions based on the resource type.

### Types

| Type       | Service             | Resolution | Environment Variable | Context value          |
| ---------- | ------------------- | ---------- | -------------------- | ---------------------- |
| `"secret"` | Secrets Manager     | Runtime    | Secret ARN           | Decrypted secret value |
| `"kms"`    | KMS                 | Deploy     | Key ARN              | —                      |
| `"role"`   | IAM                 | Deploy     | Role ARN             | —                      |
| `"ssm"`    | SSM Parameter Store | Deploy     | Parameter value      | —                      |

Only `"secret"` resources are resolved at runtime and exposed on the handler context. The remaining types exist so infrastructure can provision access. Their values are consumed from the resolved secret or by the platform itself.

### Options

| Name     | Supports   | Values                     | Default         | Description                                                        |
| -------- | ---------- | -------------------------- | --------------- | ------------------------------------------------------------------ |
| `scope`  | All types  | `"environment"`, `"stage"` | `"environment"` | Includes stage name alongside the environment in the resource path |
| `env`    | `"secret"` | `string`                   | -               | Environment variable holding the resource identifier               |
| `config` | `"secret"` | `z.ZodType`                | -               | Schema the resolved value must satisfy                             |

Secrets are fetched once per resolution and cached for ten minutes. A missing environment variable/secret, or a value that fails schema validation will throw and returns a 500 error response.

---

## Clients

Clients provide a way to communicate with third-party APIs and external data sources. They're built once per invocation and exposed on the handler context, so a gateway can declare as many clients as it needs and consume any number of them from any route handler.

```typescript
clients: ({ consumerConfig }) => ({
  api: createRestClient({
    baseUrl: consumerConfig.apiUrl,
    auth: {
      type: "sigv4",
      region: consumerConfig.region,
      roleArn: consumerConfig.consumerRoleArn,
      roleName: "consumer-session",
    },
    headers: { "Content-Type": "application/json" },
  }),
});
```

### `mapApiResult`

Transforms the `data` of a successful `ApiResult` into the gateway's own contract, leaving an error result untouched:

```typescript
const result = await api.get("/v1/example/path", {
  schema: ExpectedResponseSchema,
});

return mapApiResult(result, ({ data }) => data.newField);
```

Use this when a route's response shape should differ from the remote API's shape, rather than returning the client result directly.

### Supported Clients

| Client               | Code               | Use Case                   |
| -------------------- | ------------------ | -------------------------- |
| [REST](#rest-client) | `createRestClient` | HTTP/JSON third-party APIs |

> Additional client types will be documented here as they're implemented.

Every client type returns an `ApiResult`, so remote failures surface as values rather than exceptions:

```typescript
// Success result
{
  ok: true,
  status: 200,
  data: { key: "value" }
}

// Error result
{
  ok: false,
   error: {
    status: 502,
    message: "some error message",
    body: { /* */ }
  }
}
```

### REST Client

Built with [`createRestClient`](/libs/service-gateway/src/client/adapter/rest.ts) and exposes common HTTP methods (`get`, `post`, `put`, `patch`, `delete`). Each method takes a path and optional `query`, `headers` and `schema`, with write operations also accepting a `body`. Passing `schema` will validate and set the type of the remote response, otherwise `data` defaults to `unknown`.

```typescript
// Read operation
const result = await api.get("/v1/example/path", {
  schema: RemoteResponseSchema,
  headers: {
    // ...
  },
  query: {
    // ...
  },
});

// Write operation
const result = await api.post("/v1/example/path", {
  schema: RemoteResponseSchema,
  body: {
    // ...
  },
});
```

### Authentication

| Type       | Description                                                   |
| ---------- | ------------------------------------------------------------- |
| `"public"` | Used for unauthenticated requests                             |
| `"sigv4"`  | Used for SigV4-signed requests using assumed-role credentials |

---

## Headers

Headers declare custom request headers per route. Header keys become the property names on the handler context, decoupling the incoming header name from the alias used in the route handler.

Missing required headers return an automatic 400 response that includes a list of all missing header names. Optional headers appear as `string | undefined` in the handler context.

| Parameter  | Type      | Default | Description                                          |
| ---------- | --------- | ------- | ---------------------------------------------------- |
| `name`     | `string`  | -       | HTTP header name                                     |
| `required` | `boolean` | true    | Determines whether the header must be present or not |

---

## Infrastructure

Every `platform/domains/*/gateway.config.ts` is discovered and provisioned automatically as a single proxy route (`ANY /gateways/<name>/{proxy+}`) on the private API Gateway. The gateway strips the `/gateways/<name>` prefix before matching the inbound path against its route table.

Domains reach a gateway through a `"gateway"` integration in `domain.config.ts`. See [Integrations](/libs/sdk/README.md#integrations) and [Service Gateway Infrastructure](/docs/platform-development.md#service-gateway-infrastructure).

---

## Related

**FLEX:**

- [@flex/logging](/libs/logging/README.md)
- [@flex/sdk](/libs/sdk/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Platform Development Guide](/docs/platform-development.md)
- [Domain Development Guide](/docs/domain-development.md)
- [Developer Reference](/docs/developer-reference.md)
