---
title: Lambda constructs
description: The three Flex Lambda constructs, what each sets up, and how a domain's or gateway's access setting chooses one.
---

Every Flex Lambda function is created through one of three constructs in
[`platform/infra/flex/src/constructs/lambda/`](https://github.com/govuk-once/flex/tree/main/platform/infra/flex/src/constructs/lambda).
They differ in where the function sits on the network. Domain and gateway authors do not use them
directly: the `access` setting in their configuration picks one.

## The three constructs

| Construct | `access` | Network | Security group | Reaches |
| --- | --- | --- | --- | --- |
| `FlexPublicFunction` | `public` | Not in the VPC | None | The internet, through Lambda's own networking. Not the private API. |
| `FlexPrivateEgressFunction` | `private` | Private egress subnets | `PrivateEgress` (all outbound allowed) | The internet through the NAT gateways, and the private API and AWS services through the VPC endpoints. |
| `FlexPrivateIsolatedFunction` | `isolated` | Private isolated subnets | `PrivateIsolated` (no outbound rules) | The private API and AWS services through the VPC endpoints only. No internet. |

The VPC, its subnets, security groups and endpoints belong to the core stack; see
[Infrastructure](/flex/infrastructure/overview/#stacks). The private API only accepts requests that
arrive through its VPC endpoint, so a function that calls an
[integration](/flex/domains/integrations/) needs `private` or `isolated`.

Choose the most restricted one that works. A function that only talks to AWS services and other
domains is `isolated`. A function that must call something on the internet is `private`.

## What every construct sets up

| Setting | Value |
| --- | --- |
| Runtime | Node.js 24, bundled from TypeScript by `NodejsFunction` |
| Tracing | X-Ray active tracing |
| Timeout | 10 seconds, unless the caller sets `timeout` |
| Log group | A dedicated log group with one-year retention, encrypted with the log group key |
| Environment encryption | The environment's customer managed key, read from `/<env>/flex-param/secret/encryption-key`; the function is granted `kms:Decrypt` on it |
| `FLEX_ENVIRONMENT` | The stage name, set after the caller's `environment`, so the caller cannot override it |
| Alarms | The default Lambda alarms, named `<stage>-<id>-alarm-*`; see [Alarms](/flex/observability/alarms/) |
| Tag | `ResourceOwner` set to `domain`, when `domain` is given |

`FLEX_ENVIRONMENT` is what [logging](/flex/observability/logging/) checks to tell production apart.
Encryption at rest is described in [Data and encryption](/flex/infrastructure/data-and-encryption/).

## Props

All three take `FlexFunctionProps`: CDK's `NodejsFunctionProps` with `handler` and `runtime` made
optional, plus:

| Prop | Description |
| --- | --- |
| `entry` | Path to the handler file. Use the [entry helpers](#entry-helpers). |
| `domain` | The owning domain or gateway name, used for the `ResourceOwner` tag. |
| `criticalAction`, `warningAction` | The SNS alarm actions for the default alarms. |

The two VPC constructs also need `vpc`, and `privateEgressSg` or `privateIsolatedSg`.
`FlexPublicFunction` and `FlexPrivateEgressFunction` take `enableDefaultAlarms` (default `true`).
`FlexPrivateIsolatedFunction` always creates its alarms.

Each construct exposes the CDK function as `.function`:

```typescript
import { Duration } from "aws-cdk-lib";

import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { getPlatformEntry } from "../utils/getEntry";

const authorizer = new FlexPrivateEgressFunction(this, "AuthorizerFunction", {
  entry: getPlatformEntry("auth", "handler.ts"),
  timeout: Duration.seconds(10),
  environment: { USERPOOL_ID: userPoolId, CLIENT_ID: clientId, JWKS_URI: jwksUri },
  vpc: this.importVpc(ENV_KEYS.Vpc),
  privateEgressSg: this.importSecurityGroup(ENV_KEYS.SgPrivateEgress),
  criticalAction,
  warningAction,
});

authorizer.function.functionArn;
```

## Domain routes

The domain stack creates one function per route. The route's `access` picks the construct, then the
domain's `common.access`, then `isolated`. See [Configuration](/flex/domains/configuration/) for
where these are set.

| `access` | Construct |
| --- | --- |
| `public` | `FlexPublicFunction` |
| `private` | `FlexPrivateEgressFunction` |
| `isolated` (default) | `FlexPrivateIsolatedFunction` |

The domain stack also sets:

- the construct ID `<domain>-<gateway>-<version>-<route name>` in PascalCase, such as
  `ExamplePublicV0ListTodos` for the route named `list-todos`, which also names the function's
  alarms
- a timeout of 15 seconds unless the route or `common.function` sets `timeoutSeconds`
- 1024 MB of memory for `private` and `isolated` functions in staging and production, unless the
  route or `common.function` sets `memorySize`; otherwise CDK's default of 128 MB
- the environment variables from `common.function.environment` merged with the route's, the
  route's winning
- `domain` set to the domain name

## Service gateways

A gateway's `access` is set once, in `gateway.config.ts`, and has no default.

| `access` | Construct | Use |
| --- | --- | --- |
| `private` | `FlexPrivateEgressFunction` | The upstream is on the public internet. |
| `isolated` | `FlexPrivateIsolatedFunction` | The upstream is reachable through the VPC's interface endpoints, without the internet. |

`public` passes the schema but fails synthesis with `Unsupported route access`.

Every gateway function has a 30-second timeout. In staging and production it also gets 1024 MB of
memory and a `live` alias with two provisioned concurrent executions, and API Gateway calls the
alias. `function.enableDefaultAlarms: false` in the gateway's configuration turns off the default
alarms, for `private` gateways only. See [Gateway configuration](/flex/gateways/configuration/).

## Entry helpers

[`src/utils/getEntry.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/utils/getEntry.ts)
builds absolute handler paths from the repository root:

| Helper | Example | Resolves to |
| --- | --- | --- |
| `getDomainEntry(domain, path)` | `getDomainEntry("example", "handlers/v0/todos/get.ts")` | `domains/example/src/handlers/v0/todos/get.ts` |
| `getPlatformEntry(domain, path)` | `getPlatformEntry("auth", "handler.ts")` | `platform/domains/auth/src/handler.ts` |
| `getPlatformSmokeTestEntry(path)` | `getPlatformSmokeTestEntry("handler.ts")` | `platform/smoke-test/src/handler.ts` |

The domain stack derives each route's handler path from its route key, and the gateway code uses
`getPlatformEntry(<name>, "gateway.ts")`, so neither needs calling by hand. See
[Creating a domain](/flex/domains/creating-a-domain/) for how handler files are named.
