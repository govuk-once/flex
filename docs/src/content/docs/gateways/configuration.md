---
title: Gateway configuration
description: The defineGateway reference, covering routes, the handler context, validation, error mapping, resources and headers.
---

A gateway is declared once, in `gateway.config.ts`, with `defineGateway` from
`@flex/service-gateway`
([source](https://github.com/govuk-once/flex/blob/main/libs/service-gateway/src/config/gateway.ts)).
It returns two things, and the file must export both:

| Export | Used by | Purpose |
| --- | --- | --- |
| `config` | The CDK app, at synth | The configuration, read to provision the Lambda, route and IAM grants |
| `createHandler` | `src/gateway.ts` | Builds the Lambda handler from clients and route handlers |

[Creating a gateway](/flex/gateways/creating-a-gateway/) shows a complete configuration and
handler.

## Configuration

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | Names the gateway's route (`/gateways/<name>`), its Lambda, its log service name (`<name>-service-gateway`) and the upstream name in error messages. Must match the directory name |
| `environments` | `Environment[]` | The persistent environments the gateway deploys to: `development`, `staging`, `production`. Personal and PR stages ignore it |
| `access` | `"private" \| "isolated"` | Where the Lambda runs. No default. See [Access](/flex/gateways/overview/#access) |
| `resources` | `Record<string, Resource>` | AWS resources the gateway uses. See [Resources](#resources) |
| `function` | `{ enableDefaultAlarms?: boolean }` | Optional. `enableDefaultAlarms: false` turns off the Lambda's default alarms. Only `private` gateways honour it; `isolated` gateways always have them |
| `routes` | `Record<RouteKey, RouteConfig>` | The routes the gateway serves |

The schema also accepts an optional `policy`, which must be an empty object and has no effect.

## Route keys

A route key is `"METHOD /path"`, such as `"GET /v1/example/:id"`.

- `METHOD` is one of `GET`, `POST`, `PUT`, `PATCH` or `DELETE`.
- The path starts with a version segment by convention, such as `/v1`.
- A segment starting with `:` is a path parameter and appears on `pathParams`.
- Trailing and repeated slashes are rejected when the handler is built.

Unlike a domain's route keys, a gateway's have no access suffix. A domain can declare a public and a
private handler for the same path; a gateway's access is set once for the whole gateway.

A request matches a static route first. Otherwise the dynamic routes are tried in the order they
are declared, and the first match wins. A request path with a trailing or repeated slash matches
nothing.

## Route configuration

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The operation name |
| `query` | Zod schema | Validates the query string. The parsed value is `queryParams` |
| `headers` | `Record<string, HeaderConfig>` | Headers to read. See [Headers](#headers) |
| `body` | Zod schema | Validates the JSON body. The parsed value is `body` |
| `response` | Zod schema | Validates the data the handler returns. See [Response validation](#response-validation) |

### Headers

Each entry maps the property name used on the handler context to a header. The context name and the
header name can differ, which keeps upstream naming out of the handler.

```ts
headers: {
  requestingServiceUserId: { name: "requesting-service-user-id", required: true },
},
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | | The HTTP header name, matched case-insensitively |
| `required` | `boolean` | `true` | Whether the header must be present. An optional header is `string \| undefined` on the context |

## Handler

`createHandler` takes two properties:

| Property | Description |
| --- | --- |
| `clients` | A factory that receives the resolved [resources](#resources) and returns the clients, keyed by name. It runs once per request. See [Clients](/flex/gateways/clients/) |
| `routes` | One handler for every route key in the configuration |

### Handler context

Each handler receives a context typed from its route's configuration. A property is only present if
the route declares what it needs.

| Property | Present when |
| --- | --- |
| `logger` | Always. The `@flex/logging` logger |
| `clients` | Always. What the `clients` factory returned |
| `resources` | Always. The resolved `secret` resources, typed from their `config` schemas |
| `pathParams` | The route key has a `:param` segment |
| `queryParams` | The route declares `query` |
| `headers` | The route declares at least one header |
| `body` | The route declares `body` |

There is no `auth`. A gateway trusts its caller, which the private API has already authorised with
IAM. Anything the upstream needs about the user, such as an identifier, arrives as a header, a path
parameter or the body.

### Handler result

A handler returns a promise of an `ApiResult`, the same shape every client returns. A route that
proxies one upstream call can return the client's result as it is.

```ts
// Success
return { ok: true, status: 200, data: { key: "value" } };

// Failure
return { ok: false, error: { status: 404, message: "Not found" } };
```

A handler can also throw an error from `http-errors`. The gateway returns its status and message.
Any other thrown error becomes a `500`.

## Request validation

The request is checked before resources are resolved and before the handler runs.

| Check | Status | Body |
| --- | --- | --- |
| No route matches | `404` | `{ "message": "Route not found" }` |
| The route has no handler | `404` | `{ "message": "Route handler not found" }` |
| A required header is missing | `400` | `{ "message": "Missing headers: <names>", "headers": [...] }` |
| The query fails its schema | `400` | `{ "message": "Invalid query parameters", "errors": [...] }` |
| The body fails its schema, or is not JSON | `400` | `{ "message": "<validation message>" }` |

## Response validation

When a route declares `response`, the gateway parses the handler's `data` with it before returning.
A failure is logged and returns `502` with `{ "message": "<NAME> upstream response invalid" }`. It is
a `502` because an upstream that no longer matches the contract is an upstream fault, not the
caller's.

The check does not change the response: the gateway returns the handler's `data` as it was, not
the parsed value, so properties the schema does not declare still reach the caller. Shape the data
in the handler, for example with [`mapApiResult`](/flex/gateways/clients/#mapapiresult).

## Upstream error mapping

When a handler returns a failed result, the gateway maps it so that the caller's mistakes stay
visible to the caller and upstream faults collapse to one answer:

| Failed result status | Gateway status | Body |
| --- | --- | --- |
| `4xx` | Unchanged | `{ "message": "<message>", "error": <upstream body> }`. `error` is present only if the upstream sent a body |
| `5xx` | `502` | `{ "message": "<NAME> upstream service unavailable" }` |

`<NAME>` is the gateway's `name` in upper case. Upstream 5xx details never reach the caller.

Gateway error bodies carry `message` and no `type`. They are read by domains, which turn them into
their own responses; see [Error responses](/flex/domains/handlers/#error-responses) for the
contract the app sees.

## Resources

Resources are the AWS values a gateway needs. They are declared once for the gateway and shared by
every route.

```ts
resources: {
  consumerConfig: {
    type: "secret",
    path: "/udp/consumer-config-secret-arn",
    env: "FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN",
    config: z.object({ apiUrl: NonEmptyString, apiKey: NonEmptyString }),
  },
  consumerRole: { type: "role", path: "/udp/consumer-role-arn" },
  cmk: { type: "kms", path: "/udp/cmk-arn" },
},
```

Every resource's `path` names an SSM parameter, `/<env>/flex-param<path>`, which holds an ARN.
The CDK app reads the parameter at deploy time and grants the gateway access to what it points to.
These parameters are not created by this repository.

| Type | Infrastructure | Runtime | On the context |
| --- | --- | --- | --- |
| `secret` | Sets the environment variable named by `env` to the secret ARN and grants `secretsmanager:GetSecretValue` on it | Reads the secret as JSON and parses it with `config` | Yes, as the parsed value |
| `kms` | Grants `kms:Decrypt` on the key | None | No |
| `role` | Grants `sts:AssumeRole` on the role | None | No |
| `ssm` | Not implemented: synth throws `Not yet implemented` | | |

`kms` and `role` resources exist only to grant access. The handler takes the role ARN it assumes
from the secret, not from the `role` resource.

| Option | Applies to | Description |
| --- | --- | --- |
| `path` | All | The SSM parameter path, after `/<env>/flex-param` |
| `env` | `secret` | The environment variable that holds the secret ARN |
| `config` | `secret` | The Zod schema the secret's value must satisfy |
| `scope` | All | Accepted for consistency with domain resources, but gateway infrastructure always reads the environment-level parameter |

Secrets are cached for ten minutes in the execution environment. A missing environment variable, a
missing secret, or a value that fails `config` makes the request fail with `500` and logs the
cause.

## Logging and telemetry

The handler sets the log service name to `<name>-service-gateway` and the log level to `INFO`, and
takes the correlation id from the `x-correlation-id` header. See
[Logging](/flex/observability/logging/).

Each request emits `service_gateway_request_received` and then either
`service_gateway_response_returned` or `service_gateway_error_returned`. Clients emit their own
`third_party_*` events. See [Telemetry](/flex/observability/telemetry/) for the event catalogue.
