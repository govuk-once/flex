---
title: Current limits
description: What Flex does not support today and how to decide how to proceed.
sidebar:
  order: 3
---

Flex is still growing, so these are limits of the platform today and not permanent decisions. If you have a real need that hits one, raise it with the Flex team early so it can be planned rather than worked around. Last checked against the code in October 2026.

## Limits

- **Synchronous HTTP only.** Domains have no queue, event, schedule or cron surface. Anything asynchronous needs a conversation with the Flex team or a redesign around request and response.
- **No domain-owned persistence.** Domain config can declare only `ssm`, `ssm:runtime`, `secret` and `kms` resources. There is no DynamoDB or S3 for domains. State has to live with a partner service behind a gateway, or be derived on each request. See [Storing user data](#storing-user-data).
- **No per-domain rate limits, quotas or caching.** CloudFront and API Gateway caching are disabled until there is a platform strategy. The only rate limit is the global per-IP rule at the edge.
- **Private routes carry no user identity.** The caller must pass an explicit user id header.
- **Log levels are ignored in `production`.** It always logs at `INFO`, so debug logging can't be turned on there. Other stages honour the setting.
- **No CORS configuration.** That is fine for the GOV.UK app, which is the only client today.
- **New domains go through the Flex team.** `CODEOWNERS` routes every pull request under `domains/` to the Flex developers group.

## Handler patterns

A domain can mix these across its routes.

1. **Passthrough.** The handler validates the request and hands it to a service gateway. Flex contributes auth, validation, the published spec and edge protection, and the department's own API does the work. Start here.
2. **Transform.** The same shape, but the handler reshapes the request or response, combines several calls behind one route or derives fields. The UDP user upsert route is the heaviest example.
3. **Pure logic.** No gateway. The response is computed inside Flex, so the route must be stateless. The `example` domain has some of these.

The thinner the handler, the less there is to test and review. Add transformation only where the app's needs and the downstream API's shape really differ.

## Reaching data outside Flex

External partners are reached only through Flex-owned service gateways: `udp`, `uns`, `dvla` and `travel`.

1. **The data is behind an existing gateway, or in another Flex domain.** This is self-service. Declare an integration in `domain.config.ts` and call it from the handler. For another domain, CI checks the target route exists. For a gateway, nothing checks it until you call it.
2. **The data needs a new external partner.** This is Flex team work: gateway config, handler, CDK wiring and secrets provisioning. Treat it as a cross-team dependency and not as a domain pull request.

## Storing user data

The gateways are strict contracts and not general stores. Each one exposes only the routes in its config, each with its own schema.

UDP, the user data store, is reached through the `udp` gateway and works at two levels:

| UDP endpoints | Covers                                                                  | Shape                                 |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------- |
| Fixed         | User records, identity links (with optional tokens), SAR/DSAR           | Set by UDP                            |
| Generic data  | Notification preferences, topics, groups, under a path such as `topics` | Any JSON object. UDP doesn't check it |

The `udp` gateway is what limits the generic data endpoint. It has a route and a schema for each kind of data, so a domain can only store what those schemas allow. See the [UDP API reference](https://govuk-once.github.io/user-data-platform/).

## Deciding how to proceed

| You need                                                           | What to do                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| New read or write functionality over data already behind a gateway | Add a domain, or a route to an existing one. This is quick and self-service.                                |
| Data from a new external source                                    | Raise it with the Flex team first. The gateway is the long pole.                                            |
| Stored state, background work or events                            | Flex can't do this today. Challenge the design or raise the gap with the Flex team before committing to it. |
