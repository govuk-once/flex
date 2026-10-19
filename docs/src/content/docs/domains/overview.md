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

## Who can call a route, and what it can call

Two settings sound alike but answer different questions:

| Setting                         | Question it answers                           | Direction |
| ------------------------------- | --------------------------------------------- | --------- |
| `public` / `private` on a route | **Who can call this route?**                  | Inbound   |
| `access`                        | **What can this route's Lambda call out to?** | Outbound  |

// TODO: VERIFY

They are independent. A `private` route can have `access: "private"` or not, and so can a `public` one. The words overlap by accident.

// TODO: END VERIFY

// TODO: REWORD WITHOUT ANALOGY

Think of each route's Lambda as a room in a secure office building.

### `public` and `private`: which door

- A **public** route has a door onto the street. The GOV.UK app comes in through CloudFront, and the Lambda authorizer checks the user's token at the door. The handler knows who the user is: `auth.userId`.
- A **private** route has a staff-only door from inside the building. Only other Flex Lambdas with an IAM permission for that exact route can use it. No user token comes through it, so there is no `auth`. If the route needs to know the user, the caller passes their id in a header.

A method can have both doors: `public` and `private` are separate routes with separate handler files.

// TODO: REWORD WITHOUT ANALOGY

|            | Public                            | Private                                                 |
| ---------- | --------------------------------- | ------------------------------------------------------- |
| Caller     | The GOV.UK app                    | Another domain, through an integration                  |
| URL        | `/app/<domain>/<version>/<path>`  | `/domains/<domain>/<version>/<path>`                    |
| Checked by | Lambda authorizer (Cognito token) | IAM (SigV4-signed request)                              |
| User       | `auth.userId`                     | A declared header, such as `requesting-service-user-id` |
| Route key  | `GET /v1/topics`                  | `GET /v1/topics [private]`                              |
| File       | `get.ts`                          | `get.private.ts`                                        |

// TODO: REWORD WITHOUT ANALOGY

### `access`: which phone line

`access` says nothing about callers. It decides where the room is, and so who the Lambda can phone.

- **`"isolated"`** (the default): inside the building, with an internal line only. It can call other Flex routes and gateways through integrations, and AWS services such as SSM and Secrets Manager. It can't reach the internet.
- **`"private"`**: inside the building, with an internal line plus an outside line through a switchboard (a NAT gateway). Use it only if the handler itself must call something on the internet.
- **`"public"`**: outside the building, with an outside line only. It can reach the internet but **not** the private API Gateway, so it can't use integrations.

Leave `access` alone. A domain reaches external services through a [service gateway](/flex/platform/service-gateways/), using an integration, so `"isolated"` covers almost every domain.

// TODO: RENAME TO REAL-WORLD EXAMPLE

### Putting it together

`domains/topics` has `public` routes, so the app can call them, and `access: "isolated"`, so their Lambdas can only call Flex. They reach UDP through the `udp` service gateway, which is the Lambda that holds the outside line.

See [How Flex works](/flex/start-here/how-flex-works/) for the full request flow.

// TODO: RE-ORDER SO PERSONAL AND PR COMES FIRST, THEN REFERENCE DEPLOY ENVS INFORMATION COMING ON NEXT PAGE...

## Which environments a domain deploys to

`environments` on the domain, or on a single route, limits which of `development`, `staging` and `production` it deploys to. Leave it out and it deploys to all three.

Personal and `pr-<n>` stages always deploy every domain and route, whatever `environments` says.

## How the platform picks it up

At deploy time the platform globs `domains/*/domain.config.ts`, validates each config and builds:

- one Lambda per route, with IAM permissions for only the resources and integrations that route declares,
- the public and private API Gateway routes.

The same config drives the OpenAPI spec for each domain (`pnpm openapi:generate`). CI checks that every `domain` integration points at a private route that exists (`pnpm validate:integrations`). Gateway integrations are not checked. CI also fails a pull request that makes a breaking change to a spec.

## Next

- [Domain config reference](/flex/domains/domain-config/) for every option.
- [Writing route handlers](/flex/domains/route-handlers/) for what a handler receives and returns.
- [Current limits](/flex/start-here/current-limits/) before you design something new.
