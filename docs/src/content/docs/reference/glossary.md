---
title: Glossary
description: The terms these docs use, and what each means in Flex.
---

## Access

The network a Lambda function runs in, set by `access` on a domain route or a service gateway:

- `public`: outside the VPC.
- `private`: in the VPC's private subnets, with a route to the internet through a NAT gateway.
- `isolated`: in the VPC's isolated subnets, with no route to the internet. AWS services and the
  private API are reached through VPC endpoints. This is the default for a domain.

Access is separate from whether a route is on the public or the private API. See
[Lambda constructs](/flex/infrastructure/lambda-constructs/).

## Anti-corruption layer

A layer that translates between Flex and an external API, so the external API's shapes and errors
do not leak into domains. Each service gateway is one. Also called an ACL.

## API Gateway

Amazon API Gateway. These docs name it in full to keep it apart from a
[service gateway](#service-gateway). Each stage has two APIs in it: the
[public API](#public-api) and the [private API](#private-api).

## CloudFront Function

A small function that CloudFront runs on each request before forwarding it. Flex uses one to check
the structure of every API request, and another for the hosted API docs. Also called a CFF. See
[CloudFront Functions](/flex/edge/cloudfront-functions/).

## Core stack

The `<env>-FlexCore` stack. It holds the VPC, security groups, VPC endpoints and alarm topics.
Only persistent environments have one. Personal and PR stages use the development core stack. See
[Infrastructure](/flex/infrastructure/overview/).

## Correlation id

The `x-correlation-id` header. The platform CloudFront Function sets it on every request that lacks
a valid one, and logs and telemetry events carry it, so one request can be followed through Flex.

## Domain

A package under `domains/<name>` that holds the logic behind one area of the GOV.UK app. A
`domain.config.ts` file describes its routes, and Flex creates its infrastructure from that file.
See [Domains](/flex/domains/overview/).

## Environment

One of `development`, `staging` and `production`. Each has its own core stack. Personal and PR stages belong to the `development` environment. See
[Environments](/flex/delivery/environments/).

## Ephemeral

Describes a stage that exists for a short time and is then destroyed: a personal stage or a PR
stage. The opposite of [persistent](#persistent).

## Handler

The function that runs for one route. A domain handler is built with `route()` from `@flex/sdk`. See
[Handlers](/flex/domains/handlers/).

## Integration

A typed call that a domain declares in its configuration, to another domain's private route or to a
service gateway. The call goes through the private API, signed with SigV4. See
[Integrations](/flex/domains/integrations/).

## Lambda authorizer

The Lambda function that API Gateway calls to verify the token on a request to a public route. See
[Lambda authorizer](/flex/edge/authorizer/).

## Module E2E tests

The E2E tests a domain keeps in `domains/<name>/e2e` and runs with its `test:e2e` script. See
[Testing domains](/flex/domains/testing/).

## Pairwise id

A pseudonymous identifier for a user. The Lambda authorizer reads it from the `username` claim of
the verified token and passes it to the handler as `auth.pairwiseId`. It identifies the same user
each time without saying who they are.

## Persistent

Describes the `development`, `staging` and `production` stages, which are deployed by the pipeline
and kept running. The opposite of [ephemeral](#ephemeral).

## Platform E2E tests

The E2E suite in `tests/e2e`, which tests the platform itself against a deployed stage. See
[E2E tests](/flex/delivery/e2e-tests/).

## Platform handler

A Lambda function or CloudFront Function that is part of the platform rather than a domain, such as
the Lambda authorizer. Platform handlers live in `platform/domains/`. See
[Platform handlers](/flex/edge/platform-handlers/).

## Private API

The API Gateway REST API that Flex's own Lambda functions call. It is reachable only through the
VPC's API Gateway endpoint, and every route uses IAM authorisation. It serves domains' private
routes under `/domains/` and service gateways under `/gateways/`. See
[The platform](/flex/start/platform/).

## Public API

The API Gateway REST API that the GOV.UK app calls, through CloudFront. It serves domains' public
routes under `/app/`, and the Lambda authorizer protects them. See
[The platform](/flex/start/platform/).

## Resource

An SSM parameter, Secrets Manager secret or KMS key that a domain or service gateway declares, and
that Flex resolves and grants access to. See [Resources](/flex/domains/resources/).

## Route

A method and path that a domain serves, such as `GET /v1/users/push-id`. Each route has its own
Lambda function. An integration names the route it calls in this form, called a route key.

## Service gateway

A Lambda function, owned by the Flex team, that sits in front of one external API and acts as its
[anti-corruption layer](#anti-corruption-layer). Domains reach it through the private API at
`/gateways/<name>/`. See [Service gateways](/flex/gateways/overview/).

## Stage

The name of one deployment of Flex. Stack names start with it. A stage is your username for a
personal environment, `pr-<number>` for a pull request, or the environment's name. Flex lowercases
it, removes anything other than letters, numbers and hyphens, and keeps the first 12 characters. See
[Environments](/flex/delivery/environments/).

## Telemetry event

A named event, such as `auth_success`, that Flex writes to its logs at each step of a request. See
[Telemetry](/flex/observability/telemetry/).

## UDP

The User Data Platform. It holds what GOV.UK keeps about a user of the app, such as their linked
service identities and notification preferences. Flex reaches it through the `udp` service gateway.

## UNS

The external service behind the `uns` service gateway, which holds the notifications sent to a
user.
