---
title: Repository tour
description: Where things live in the Flex repository.
sidebar:
  order: 4
---

Flex is a pnpm monorepo, orchestrated with Nx. Every top-level folder is a set of workspace packages.

| Path | What is in it |
| --- | --- |
| [`domains/`](https://github.com/govuk-once/flex/tree/main/domains) | Domains, each with a `domain.config.ts`, handlers, unit tests and an `e2e/` folder. `topics` is a good small example. `example` shows most of the config options. |
| [`libs/`](https://github.com/govuk-once/flex/tree/main/libs) | Shared `@flex/*` packages (see below). |
| [`platform/domains/`](https://github.com/govuk-once/flex/tree/main/platform/domains) | Platform handlers: the Lambda authorizer, the CloudFront functions, the service gateways (`udp`, `uns`, `dvla`, `travel`) and the credential monitoring and rotation functions. |
| [`platform/infra/flex/`](https://github.com/govuk-once/flex/tree/main/platform/infra/flex) | The CDK app: stacks, constructs and SSM keys. |
| [`platform/shared/`](https://github.com/govuk-once/flex/tree/main/platform/shared) and [`platform/smoke-test/`](https://github.com/govuk-once/flex/tree/main/platform/smoke-test) | Code shared across platform packages, and the post-deploy smoke test. |
| [`tests/`](https://github.com/govuk-once/flex/tree/main/tests) | Platform end-to-end tests (`e2e`) and Artillery load tests (`performance`). |
| [`scripts/`](https://github.com/govuk-once/flex/tree/main/scripts) | Repository scripts, such as `pnpm jwt` and OpenAPI generation. |
| [`docs/`](https://github.com/govuk-once/flex/tree/main/docs) | This documentation site. |
| [`.github/`](https://github.com/govuk-once/flex/tree/main/.github) | Workflows, `CODEOWNERS` and `CONTRIBUTING.md`. |

## Libraries

| Package | Purpose |
| --- | --- |
| [`@flex/sdk`](https://github.com/govuk-once/flex/tree/main/libs/sdk) | `domain()` config and the `route()` handler factory. This is the package domain engineers use most. |
| [`@flex/testing`](https://github.com/govuk-once/flex/tree/main/libs/testing) | Unit and E2E test fixtures. |
| [`@flex/utils`](https://github.com/govuk-once/flex/tree/main/libs/utils) | Shared schemas, types and HTTP utilities. |
| [`@flex/logging`](https://github.com/govuk-once/flex/tree/main/libs/logging) | Structured logging with Lambda Powertools. |
| [`@flex/telemetry`](https://github.com/govuk-once/flex/tree/main/libs/telemetry) | Telemetry events, emitted as structured log lines. |
| [`@flex/service-gateway`](https://github.com/govuk-once/flex/tree/main/libs/service-gateway) | Declarative gateway config and handler creation. |
| [`@flex/config`](https://github.com/govuk-once/flex/tree/main/libs/config) | Shared ESLint, TypeScript and Vitest configuration. |

Package READMEs are the source of truth for each package's API. This site links to them and doesn't copy them.

## How a domain maps to the platform

The platform globs `domains/*/domain.config.ts` at deploy time and builds each domain's stack from it. There is no central registry to edit. Handler files are found from the route definition by naming convention. See [Domains](/flex/domains/overview/) for the details.
