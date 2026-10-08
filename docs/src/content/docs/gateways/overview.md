---
title: How a service gateway works
description: What a service gateway is, how the platform provisions it, and what happens to a request on its way through.
---

A service gateway is a Lambda function that sits between Flex and one third-party API. It is an
anti-corruption layer: domains call the gateway with a Flex contract, and the gateway translates
that call into whatever the upstream expects, then translates the answer back. The gateway holds
the upstream's credentials and network access, so no domain ever sees them.

Gateways are built with
[`@flex/service-gateway`](https://github.com/govuk-once/flex/tree/main/libs/service-gateway) and
live under `platform/domains/<name>/`, next to the platform handlers. The gateways in the
repository today are listed in the [catalogue](/flex/gateways/catalogue/).

## Gateways and domain handlers

Both are declared with a configuration and a handler factory, and both give each route a typed
context. They are built for different jobs and are not interchangeable.

| | Domain handler | Service gateway |
| --- | --- | --- |
| Package | `@flex/sdk` | `@flex/service-gateway` |
| Lives in | `domains/<name>/` | `platform/domains/<name>/` |
| Purpose | Business logic behind the app's public and private API | One upstream API behind a Flex contract |
| Caller | The app, or another domain | A domain, through an integration |
| Exposure | Public and private API Gateway | Private API Gateway only |
| `auth` on the context | Yes, on public routes | No |
| Outbound calls | Integrations to domains and gateways | Clients to the upstream |

## How a gateway is provisioned

No one registers a gateway by hand. When the CDK app synthesises, it finds every
`platform/domains/*/gateway.config.ts`, imports the `config` export and validates it against
`GatewayConfigSchema`
([`config-loader.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/utils/config-loader.ts)).
A configuration that fails validation stops the synth and names the file.

For each gateway,
[`createServiceGateway`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/utils/create-service-gateway.ts)
adds to the `<stage>-FlexPlatform` stack:

- a Lambda function built from `platform/domains/<name>/src/gateway.ts`, where `<name>` is the
  gateway's configured `name`
- one proxy route, `ANY /gateways/<name>/{proxy+}`, on the private API Gateway, with IAM
  authorisation
- the IAM grants and environment variables its [resources](/flex/gateways/configuration/#resources)
  need

| Setting | Value |
| --- | --- |
| Timeout | 30 seconds |
| Memory | 1024 MB in `staging` and `production`, the Lambda default of 128 MB elsewhere |
| Provisioned concurrency | 2, on a `live` alias, in `staging` and `production` only |
| Stages | Personal and PR stages deploy every gateway. `development`, `staging` and `production` deploy only the gateways that list them in `environments` |

Because the route is a proxy, adding or changing a route inside a gateway needs no infrastructure
change.

## Access

`access` decides where the gateway's Lambda runs. It is set once for the whole gateway and has no
default.

| Value | Construct | Use it when |
| --- | --- | --- |
| `"private"` | `FlexPrivateEgressFunction` | The upstream is reached over the internet, through the NAT gateway. This includes AWS services with no VPC endpoint, such as DynamoDB |
| `"isolated"` | `FlexPrivateIsolatedFunction` | Everything the gateway calls is reachable from inside the VPC with no internet route, such as a private API called with SigV4. The VPC has interface endpoints for API Gateway, CloudWatch Logs, Secrets Manager, SSM, STS and KMS |

The configuration schema also accepts `"public"`, but `createServiceGateway` throws
`Unsupported route access` for it, so synth fails. See
[Lambda constructs](/flex/infrastructure/lambda-constructs/) for what each construct sets up.

## A request through a gateway

A domain calls a gateway by declaring an integration of type `"gateway"` in its `domain.config.ts`.
The platform grants the domain's Lambda `execute-api:Invoke` on that one route of the private API.
See [Integrations](/flex/domains/integrations/) for how to declare and call one.

The gateway handler then works through the request in a fixed order:

| Step | What happens | Failure |
| --- | --- | --- |
| Logging | The logger takes the correlation id from the `x-correlation-id` header | |
| Path | `/gateways/<name>` is stripped from the path | |
| Routing | The method and remaining path are matched against the configured route keys | `404 Route not found` |
| Handler | The route's handler is looked up | `404 Route handler not found` |
| Request | Headers, query parameters and body are checked against the route's configuration | `400` |
| Resources | Secrets are read from Secrets Manager and validated | `500` |
| Clients | The `clients` factory builds the upstream clients from the resolved resources | |
| Handler | The route handler runs and returns an `ApiResult` | Thrown errors become `500`, or the status of an `http-errors` error |
| Upstream errors | A failed result is mapped: 4xx keeps its status, 5xx becomes `502` | |
| Response | The data is checked against the route's `response` schema, if it has one | `502` |

[Configuration](/flex/gateways/configuration/) describes each step and every response the gateway
returns.
