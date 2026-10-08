---
title: Environment variables
description: Every environment variable Flex reads, who sets it, and the page that explains it.
---

This page lists every environment variable Flex reads, one line each. Follow the link for what it
means and how to use it.

## When you run commands

| Variable | Read by | Meaning |
| --- | --- | --- |
| `STAGE` | The CDK app, `pnpm jwt`, E2E and performance tests, scripts | The stage to build, deploy or test against, such as `development` or `pr-123`. See [Environments](/flex/delivery/environments/). |
| `USER` | The CDK app, E2E tests | Your username. Used as the stage when `STAGE` is not set, giving you a personal stage. See [Environments](/flex/delivery/environments/). |
| `domain` | The CDK app | Builds only this domain's stack, alongside the platform stacks. See [Environments](/flex/delivery/environments/). |
| `AWS_REGION` | E2E tests, `pnpm s3:enforce-tls`, performance report | The AWS region to call, normally `eu-west-2`. |
| `CDK_DEFAULT_ACCOUNT` | The CDK app | The AWS account to deploy to. The CDK CLI sets it from your credentials. See [AWS credentials](/flex/start/environment-setup/#aws-credentials). |
| `DOCS_PORT` | `pnpm docs:serve` | The port for the local Swagger UI. Defaults to `4400`. See [OpenAPI](/flex/domains/openapi/). |

The CDK app turns the stage into a stack name prefix with `getEnvConfig`; see
[Stage and environment](/flex/infrastructure/overview/#stage-and-environment).

## In deployed Lambda functions

### Set by the platform

| Variable | Set on | Meaning |
| --- | --- | --- |
| `FLEX_ENVIRONMENT` | Every function built with a Flex Lambda construct | The stage name. Set after the function's own variables, so it cannot be overridden. See [Lambda constructs](/flex/infrastructure/lambda-constructs/). |
| `<resource key>` | Domain functions | One variable per resource the route uses, named after the resource's key. It holds the value or the resource's name, depending on the type. See [Resources](/flex/domains/resources/). |
| `<resource env>` | Gateway functions | One variable per secret resource, named by its `env` field, holding the secret's ARN. See [Gateway configuration](/flex/gateways/configuration/). |
| `USERPOOL_ID`, `CLIENT_ID`, `JWKS_URI` | The authorizer | The Cognito user pool and client to accept tokens from, and where to fetch signing keys. See [Authorizer](/flex/edge/authorizer/). |
| `TARGET_TOPIC_ARN` | The alarm relay | The eu-west-2 SNS topic the relay forwards alarms to. See [Alarms](/flex/observability/alarms/). |
| `AWS_REGION` | Every function | Set by Lambda. Domains need it to sign integration calls, and the authorizer to build the token issuer. |

### Set by you

| Variable | Meaning |
| --- | --- |
| Anything in `function.environment` | A domain's own variables, from `common.function.environment` and the route's. See [Configuration](/flex/domains/configuration/). |
| `<feature flag key>` | `"true"` or `"false"` overrides that feature flag. See [Configuration](/flex/domains/configuration/). |
| `FLEX_LOG_PII_DEBUG` | `true` stops redacting personal data from logs, outside production. See [Logging](/flex/observability/logging/#personal-data-debug-toggle). |
| `FLEX_ORG`, `FLEX_TEAM` | Added to every log line as `org` and `team`. See [Logging](/flex/observability/logging/#log-format). |

The domain SDK reads `STAGE` to choose each feature flag's per-environment value. The Lambda
constructs do not set `STAGE`, so unless a domain sets it in `function.environment`, flags resolve
as in `development` in every environment.

`POWERTOOLS_LOG_LEVEL` and `LOG_LEVEL` have no effect; see
[Log levels](/flex/observability/logging/#log-levels).

## In tests

| Variable | Read by | Meaning |
| --- | --- | --- |
| `FLEX_API_URL`, `FLEX_PRIVATE_GATEWAY_URL` | Platform and module E2E tests | The public and private API URLs. Set both, with `STAGE`, to skip looking them up from the stacks' outputs. See [E2E tests](/flex/delivery/e2e-tests/). |
| `FLEX_GATEWAY_NAME` | The `platform` test fixture | The gateway under test, set in a gateway's `vitest.config.ts`. See [Testing gateways](/flex/gateways/testing/). |
| `NODE_ENV` | The domain SDK | Vitest sets it to `test`, which stops the SDK clearing `/tmp` after each handler call. |
| `BASE_URL` | Performance tests | The API URL to test. See [Performance tests](/flex/delivery/performance-tests/). |
| `PERF_SCENARIO`, `PERF_POOL_SIZE`, `PERF_WARM_USERS`, `PERF_PRIVATE_JWK` | Performance tests | The scenario name, how many test users' tokens to create, whether to create the users first, and a private key to sign tokens with locally. See [Performance tests](/flex/delivery/performance-tests/). |
| `LAMBDA_FUNCTION_NAMES`, `AWS_DEFAULT_REGION` | The performance report | Comma-separated functions to include in the report, and a fallback for `AWS_REGION`. See [Performance tests](/flex/delivery/performance-tests/). |

## In CI

Workflows set `STAGE` and `AWS_REGION` for every job that touches AWS; see
[Pipeline](/flex/delivery/pipeline/). Two scripts write back to GitHub Actions:
`validate:macie-coverage` writes the uncovered domains to `GITHUB_OUTPUT`, and `pnpm dastSetup`
writes a bearer token for the ZAP scan to `GITHUB_ENV`. See
[Security scanning](/flex/delivery/security-scanning/).
