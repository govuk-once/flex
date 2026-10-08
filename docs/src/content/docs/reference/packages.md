---
title: Packages
description: Every package in the pnpm workspace, where it lives and what it holds.
---

The workspace is defined in
[`pnpm-workspace.yaml`](https://github.com/govuk-once/flex/blob/main/pnpm-workspace.yaml). Every
package exports its TypeScript sources directly, with no build step. See
[Working in the repo](/flex/start/working-in-the-repo/#no-build-step-for-libraries).

Run a package's scripts with `pnpm --filter <name> <script>`.

## Shared libraries

| Package                 | Directory             | Holds                                                                                                                                   |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@flex/sdk`             | `libs/sdk`            | `domain()` and `route()`: domain configuration, handlers, resources and integrations. See [Configuration](/flex/domains/configuration/). |
| `@flex/service-gateway` | `libs/service-gateway` | `defineGateway` and the clients a service gateway uses to call an external API. See [Configuration](/flex/gateways/configuration/).     |
| `@flex/logging`         | `libs/logging`        | Structured logging on AWS Lambda Powertools, with redaction. See [Logging](/flex/observability/logging/).                               |
| `@flex/telemetry`       | `libs/telemetry`      | Telemetry events, and a version for CloudFront Functions at `@flex/telemetry/cff`. See [Telemetry](/flex/observability/telemetry/).     |
| `@flex/testing`         | `libs/testing`        | Vitest fixtures and helpers for unit and E2E tests, and the token generators. See [@flex/testing](/flex/reference/flex-testing/).        |
| `@flex/utils`           | `libs/utils`          | Shared schemas, types and helpers, including environment and stage handling. See [@flex/utils](/flex/reference/flex-utils/).            |
| `@flex/config`          | `libs/config`         | The shared ESLint, TypeScript and Vitest configuration. See [@flex/config](/flex/reference/flex-config/).                               |
| `@flex/cli`             | `libs/cli`            | The terminal CLI that `pnpm dev` starts. It is still in development.                                                                     |

## Domains

Each domain is a package named `@flex/<name>-domain` in `domains/<name>`. It exports its
configuration at `@flex/<name>-domain/config`, and its schemas and types from the package root, so
another domain can reuse them. What each domain does is in the
[domain catalogue](/flex/domains/catalogue/).

| Package                      | Directory               |
| ---------------------------- | ----------------------- |
| `@flex/dvla-domain`          | `domains/dvla`          |
| `@flex/example-domain`       | `domains/example`       |
| `@flex/groups-domain`        | `domains/groups`        |
| `@flex/local-council-domain` | `domains/local-council` |
| `@flex/topics-domain`        | `domains/topics`        |
| `@flex/travel-domain`        | `domains/travel`        |
| `@flex/udp-domain`           | `domains/udp`           |
| `@flex/uns-domain`           | `domains/uns`           |

## Service gateways and platform handlers

These live in `platform/domains/`. The Flex team owns them.

| Package                                | Directory                                      | Holds                                                                                                                 |
| -------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `@flex/dvla-service-gateway`           | `platform/domains/dvla`                        | The DVLA service gateway. See the [gateway catalogue](/flex/gateways/catalogue/).                                     |
| `@flex/travel-service-gateway`         | `platform/domains/travel`                      | The travel service gateway. See the [gateway catalogue](/flex/gateways/catalogue/).                                   |
| `@flex/udp-service-gateway`            | `platform/domains/udp`                         | The User Data Platform service gateway. See the [gateway catalogue](/flex/gateways/catalogue/).                        |
| `@flex/uns-service-gateway`            | `platform/domains/uns`                         | The UNS service gateway. See the [gateway catalogue](/flex/gateways/catalogue/).                                      |
| `@platform/dvla-secret-rotation`       | `platform/domains/dvla-secret-rotation`        | The Lambda that rotates the DVLA credentials in Secrets Manager. The core stack deploys it.                            |
| `@platform/auth`                       | `platform/domains/auth`                        | The Lambda authorizer, and the stub JWKS endpoint used in development. See [Lambda authorizer](/flex/edge/authorizer/). |
| `@platform/viewer-request-cff-platform` | `platform/domains/viewer-request-cff-platform` | The CloudFront Function that checks each API request. See [CloudFront Functions](/flex/edge/cloudfront-functions/).   |
| `@platform/viewer-request-cff-docs`    | `platform/domains/viewer-request-cff-docs`     | The CloudFront Function for the hosted API docs. See [CloudFront Functions](/flex/edge/cloudfront-functions/).        |

## Infrastructure

| Package                 | Directory             | Holds                                                                                                                                  |
| ----------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `@platform/flex`        | `platform/infra/flex` | The CDK app: every stack, the Lambda constructs and the deploy scripts. See [Infrastructure](/flex/infrastructure/overview/).          |
| `@platform/smoke-test`  | `platform/smoke-test` | The smoke test Lambda that the smoke test stack runs every five minutes. See [Alarms](/flex/observability/alarms/).                    |
| `@flex/platform-shared` | `platform/shared`     | `createConsumerConfigLoader` and `createNormalizeInboundPath`, helpers for platform code. No other package depends on it yet.          |

## Tests and tooling

| Package                   | Directory           | Holds                                                                                                                  |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@flex/e2e`               | `tests/e2e`         | The platform E2E suite. See [E2E tests](/flex/delivery/e2e-tests/).                                                    |
| `@flex/performance-tests` | `tests/performance` | Artillery performance tests. See [Performance tests](/flex/delivery/performance-tests/).                               |
| `@flex/scripts`           | `scripts`           | The scripts behind the root commands, and their tests. See [Root commands](/flex/start/working-in-the-repo/#root-commands). |
| `@flex/docs`              | `docs`              | This site.                                                                                                             |
