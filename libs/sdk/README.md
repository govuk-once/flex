# @flex/sdk

Declarative domain configuration for the FLEX platform. Handles route handler creation, AWS resource resolution, service-to-service communication via integrations and automated CDK infrastructure generated from a single configuration file.

---

## Commands

Run these from the repository root:

| Command                        | Description    |
| ------------------------------ | -------------- |
| `pnpm --filter @flex/sdk lint` | Lint files     |
| `pnpm --filter @flex/sdk test` | Run tests      |
| `pnpm --filter @flex/sdk tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `libs/sdk/`.

## API

| Name                | Description                                    | Code                    |
| ------------------- | ---------------------------------------------- | ----------------------- |
| [`domain`](#domain) | Domain configuration and route handler factory | [View](./src/domain.ts) |

---

## `domain`

Creates the domain configuration and exposes a factory for building route handlers and a utility for accessing route context.

> `domain` should only be called once and will expose the functionality needed for building lambda handlers and provisioning the necessary infrastructure.

### Usage

```typescript
import { domain } from "@flex/sdk";
import { createUserRequestSchema } from "@flex/udp-domain";

export const { config, route, routeContext } = domain({
  name: "my-domain",
  resources: {
    exampleKey: { type: "secret", path: "/path/to/key" },
  },
  routes: {
    v1: {
      "/user": {
        GET: {
          public: {
            name: "get-user",
            resources: ["exampleKey"],
          },
        },
        POST: {
          private: {
            name: "create-user",
            body: createUserRequestSchema,
          },
        },
      },
    },
  },
});
```

### API

| Property       | Type                                             | Description                                  |
| -------------- | ------------------------------------------------ | -------------------------------------------- |
| `config`       | `Config extends DomainConfig`                    | Domain configuration for CDK consumption     |
| `route`        | `RouteHandler<Config>`                           | Handler factory for creating Lambda handlers |
| `routeContext` | `<Route extends DomainRoutes>() => RouteContext` | Utility for accessing Lambda handler context |

### Route Key

Route keys identify which endpoint a handler will serve. Only routes defined in the domain configuration will be available as a valid route key:

| Format                             | Example                     |
| ---------------------------------- | --------------------------- |
| `"METHOD /version/path"`           | `"GET /v1/user"`            |
| `"METHOD /version/path [private]"` | `"POST /v1/user [private]"` |

### Handler Context

The context object passed to the handler is scoped to the route definition. Only known properties defined for that route are included:

| Property       | Condition                                          |
| -------------- | -------------------------------------------------- |
| `logger`       | All handlers                                       |
| `auth`         | All non-public handlers                            |
| `body`         | Included when the route declares a `body` schema   |
| `queryParams`  | Included when the route declares a `query` schema  |
| `pathParams`   | Included when the path contains a `:param` segment |
| `headers`      | Included when the route declares a header          |
| `resources`    | Included when the route declares a resource        |
| `integrations` | Included when the route declares an integration    |

See [Handler Patterns](/docs/domain-development.md#handler-patterns) for examples of each context property.

### Handler Result

Handlers return one of three response shapes. The SDK handles the conversion to an API Gateway proxy result:

```typescript
// Success response (with data)
return {
  status: 200,
  data: { key: "value" },
};

// Success response (no content)
return { status: 204 };

// Error response
return {
  status: 400,
  error: { message: "some error message" },
};
```

Handlers can also throw from `http-errors` for standard error responses. See [Handler Integrations](/docs/domain-development.md#with-integrations) for an example:

### Response Validation

When a route defines a `response` schema, the SDK validates the handler's response `data` against it. Validation errors are logged and return a 500 response. Set the log level to `DEBUG` or `TRACE` to include validation errors in the response body.

### Common Defaults

Common fields apply defaults across all routes. Route-level config takes precedence:

| Common Field | Type                                  | Default      | Description                                 |
| ------------ | ------------------------------------- | ------------ | ------------------------------------------- |
| `access`     | `"public" \| "private" \| "isolated"` | `"isolated"` | Default Lambda network access               |
| `logLevel`   | `LogLevel`                            | `"INFO"`     | Define log level                            |
| `function`   | `FunctionConfig`                      | —            | Default Lambda options                      |
| `headers`    | `Record<string, HeaderConfig>`        | —            | Headers that must be included on all routes |

See [Domain Configuration](/docs/domain-development.md#domain-configuration) for a more complete example.

#### With Route Context

Export typed context utilities to access handler context externally. Context is stored using `AsyncLocalStorage` so it's only accessible during handler execution:

```typescript
export const getUserContext = routeContext<"GET /v1/user">;
export const createUserContext = routeContext<"POST /v1/user">;
```

See [With Route Context](/docs/domain-development.md#with-route-context) for a complete example including helper functions and `AsyncLocalStorage` scope rules.

---

## Resources

Declare AWS-managed values that the platform provisions and injects into the Lambda environment. Resources are declared at domain level and referenced per route.

> Resource keys become Lambda environment variable names and are granted the appropriate IAM permissions based on the resource type.

### Types

| Type            | Service             | Resolution | Environment Variable | Context value          |
| --------------- | ------------------- | ---------- | -------------------- | ---------------------- |
| `"kms"`         | KMS                 | Deploy     | Key ARN              | Key ARN                |
| `"secret"`      | Secrets Manager     | Runtime    | Secret name          | Decrypted secret value |
| `"ssm"`         | SSM Parameter Store | Deploy     | Parameter value      | Parameter value        |
| `"ssm:runtime"` | SSM Parameter Store | Runtime    | Parameter name       | Parameter value        |

Deploy-time resources have their resolved values baked into the Lambda environment at deployment. Runtime resources store the resource name in the environment variable and the handler middleware is where the value is resolved.

### Options

| Name    | Supports                             | Values                     | Default         | Description                                                        |
| ------- | ------------------------------------ | -------------------------- | --------------- | ------------------------------------------------------------------ |
| `scope` | `"secret"`, `"ssm"`, `"ssm:runtime"` | `"environment"`, `"stage"` | `"environment"` | Includes stage name alongside the environment in the resource path |

See [With Resources](/docs/domain-development.md#with-resources) for an example.

---

## Integrations

Integrations declare HTTP clients for calling other domains through the FLEX private gateway. All calls are SigV4-signed.

### Types

| Type        | Path prefix                    | Wildcard | Use case                                           |
| ----------- | ------------------------------ | -------- | -------------------------------------------------- |
| `"gateway"` | `/gateways/{target}/{version}` | Yes      | Route to any path on the target domain             |
| `"domain"`  | `/domains/{target}/{version}`  | No       | Call a specific endpoint with an optional contract |

When `target` is omitted, it defaults to the current domain name.

### Invocation

```typescript
// Wildcard integration: path must be provided when called
const result = await integrations.udpRead({
  path: "/user",
  // pass options...
});

// Integrations accept optional request/response types depending on the HTTP method
const result = await integrations.udpWrite<RequestSchema, ResponseSchema>({
  path: "/user",
  // pass options...
});

const result = await integrations.udpRead<ResponseSchema>({
  path: "/user",
  // pass options...
});

// Fixed endpoint integration: path is already defined, body and response are typed (if schemas were provided)
const result = await integrations.udpPatchUser({
  body: {
    preferences: {
      notifications: {
        consentStatus: "unknown",
      },
    },
  },
});
```

### IntegrationResult

```typescript
// Success result
{
  ok: true,
  status: 200,
  data: {
    key: "value",
  }
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

### Options

| Name            | Description                                                                     |
| --------------- | ------------------------------------------------------------------------------- |
| `target`        | Target domain name (Default to same domain)                                     |
| `body`          | Request body schema                                                             |
| `response`      | Response schema                                                                 |
| `retryAttempts` | Number of retry attempts on failed requests (default set by `@flex/flex-fetch`) |
| `maxRetryDelay` | Maximum delay between each retry (default set by `@flex/flex-fetch`)            |

> Any route using integrations must explicitly include the private gateway URL resource (e.g. `flexPrivateGatewayUrl`) in its route config `resources`.

See [With Integrations](/docs/domain-development.md#with-integrations) for an example.

---

## Headers

Headers declare custom request headers at the common or route level. Route headers merge with common headers, with route-level values taking precedence.

Missing required headers return an automatic 400 response including a list of all missing header names. Optional headers appear as `string | undefined` in the handler context.

| Parameter  | Type      | Default | Description                               |
| ---------- | --------- | ------- | ----------------------------------------- |
| `name`     | `string`  | —       | HTTP header name (case-insensitive)       |
| `required` | `boolean` | true    | Whether the header must be present or not |

See [With Headers](/docs/domain-development.md#with-headers) for an example.

---

## Related

**FLEX:**

- [@flex/logging](/libs/logging/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Domain Development Guide](/docs/domain-development.md)
- [Platform Development Guide](/docs/platform-development.md)
- [Developer Reference](/docs/developer-reference.md)
