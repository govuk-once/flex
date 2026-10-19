---
title: Overview
description: What a domain is and how it fits into Flex.
sidebar:
  order: 1
---

A domain is a workspace package under `domains/` that owns a set of related routes. It has a typed `domain.config.ts` and one handler file per route. The platform builds its infrastructure from the config, so there is nothing to register elsewhere.

New to domains? Build one end to end with [Your first domain](/flex/getting-started/your-first-domain/) first.

## What a domain is made of

```text
domains/<name>/
├── domain.config.ts
├── src/
│   └── handlers/
│       └── <version>/<path>/
│           ├── <method>.ts
│           ├── <method>.test.ts
│           ├── <method>.private.ts
│           └── <method>.private.test.ts
├── e2e/
├── package.json
├── README.md
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
└── vitest.e2e.config.ts
```

:::tip
Some examples that may be useful:

- [`domains/topics`](https://github.com/govuk-once/flex/tree/main/domains/topics) is a small, real domain
- [`domains/example`](https://github.com/govuk-once/flex/tree/main/domains/example) uses most of the config options
  :::

### Routes map to files

Each route in the config is its own Lambda. The handler file is found from the route by convention:

| Route                       | File                                     |
| --------------------------- | ---------------------------------------- |
| `GET /v1/topics`            | `src/handlers/v1/topics/get.ts`          |
| `GET /v1/topics/:id`        | `src/handlers/v1/topics/[id]/get.ts`     |
| `POST /v1/topics [private]` | `src/handlers/v1/topics/post.private.ts` |

To add a route to an existing domain, add it to `routes` in the config and create the handler file at the path above. Nothing needs registering, because the platform and CI find it from the config. The [route options](/flex/domains/domain-config/#route-options) table lists everything a route can declare.

## Who can call a route, and what it can call

Two settings sound alike but answer different questions:

| Setting                         | Question it answers                           | Direction |
| ------------------------------- | --------------------------------------------- | --------- |
| `public` / `private` on a route | **Who can call this route?**                  | Inbound   |
| `access`                        | **What can this route's Lambda call out to?** | Outbound  |

They are independent, and any combination is valid. For example, a `public` route with `access: "isolated"` (the usual case), or a `private` route with `access: "private"`.

### `public` and `private`: who can call the route

- A **public** route is called by the GOV.UK app, through CloudFront. The Lambda authorizer checks the user's token, so the handler knows who the user is: `auth.userId`.
- A **private** route is called only by other Flex Lambdas that have an IAM permission for that exact route. No user token comes with the request, so there is no `auth`. If the route needs to know the user, the caller passes their id in a header.

A method can have both: `public` and `private` are separate routes with separate handler files.

|            | Public                            | Private                                                 |
| ---------- | --------------------------------- | ------------------------------------------------------- |
| Caller     | The GOV.UK app                    | Another domain, through an integration                  |
| URL        | `/app/<domain>/<version>/<path>`  | `/domains/<domain>/<version>/<path>`                    |
| Checked by | Lambda authorizer (Cognito token) | IAM (SigV4-signed request)                              |
| User       | `auth.userId`                     | A declared header, such as `requesting-service-user-id` |
| Route key  | `GET /v1/topics`                  | `GET /v1/topics [private]`                              |
| File       | `get.ts`                          | `get.private.ts`                                        |

### `access`: where the Lambda runs

`access` says nothing about who can call the route. It decides where the route's Lambda runs, and so what it can reach.

- **`"isolated"`** (the default): in the VPC, with no internet access. It can call other Flex routes and gateways through integrations, and AWS services such as SSM and Secrets Manager.
- **`"private"`**: in the VPC, with internet access through a NAT gateway. Use it only if the handler itself must call something on the internet.
- **`"public"`**: outside the VPC, with internet access. It can't reach the private API Gateway, so it can't use integrations.

Leave `access` alone. A domain reaches external services through a [service gateway](/flex/platform/service-gateways/), using an integration, so `"isolated"` covers almost every domain. See [Access](/flex/domains/domain-config/#access) for the full comparison.

### Example: the topics domain

`domains/topics` has `public` routes, so the app can call them, and `access: "isolated"`, so their Lambdas can only call Flex. They reach UDP through the `udp` service gateway, which is the Lambda that can reach the internet. Because it makes integration calls, the domain declares the [private gateway URL](/flex/domains/domain-config/#the-private-gateway-url) as a resource, which every integration needs.

```text
GOV.UK app → CloudFront → Lambda authorizer → topics Lambda → private API Gateway → udp gateway → UDP
```

See [How Flex works](/flex/start-here/how-flex-works/) for the full request flow.

## Which environments a domain deploys to

Personal and `pr-<n>` stages deploy every domain and route by default, whatever `environments` says. You can also deploy a single domain to them. See [Deploying](/flex/domains/deploying/).

For the persistent environments (`development`, `staging` and `production`), `environments` on the domain, or on a single route, limits where it deploys. Leave it out and it deploys to all three. See [`environments`](/flex/domains/domain-config/#top-level) for details.

## How the platform picks it up

At deploy time the platform globs `domains/*/domain.config.ts`, validates each config and builds:

- one Lambda per route, with IAM permissions for only the resources and integrations that route declares,
- the public and private API Gateway routes.

The same config drives the OpenAPI spec for each domain (`pnpm openapi:generate`). CI checks that every `domain` integration points at a private route that exists (`pnpm validate:integrations`). Gateway integrations are not checked. CI also fails a pull request that makes a breaking change to a spec.

## Next

- [Domain config reference](/flex/domains/domain-config/) for every option.
- [Writing route handlers](/flex/domains/route-handlers/) for what a handler receives and returns.
- [Current limits](/flex/start-here/current-limits/) before you design something new.
