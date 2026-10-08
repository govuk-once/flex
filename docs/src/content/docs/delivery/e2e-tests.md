---
title: E2E tests
description: The platform end-to-end suite, how E2E tests find a deployed stage, how to run them, and how platform and module E2E run in CI.
---

End-to-end tests run against a deployed stage. There are two kinds.

| Suite | Lives in | Package | Covers |
| --- | --- | --- | --- |
| Platform E2E | `tests/e2e/src/platform/` | `@flex/e2e` | Authentication at CloudFront, the private API Gateway refusing public traffic, security headers |
| Module E2E | `domains/<domain>/e2e/` | `@flex/<domain>-domain` | One domain's routes |

This page covers the platform suite and how both kinds run. Writing a module suite is covered in
[Testing domains](/flex/domains/testing/), and the fixtures both use are in
[`@flex/testing`](/flex/reference/flex-testing/).

## In CI

| Pipeline | Stage | Platform E2E | Module E2E |
| --- | --- | --- | --- |
| Pull request | `pr-<number>` | After the deploy, in the same job | After the deploy, one job per domain |
| Continuous Deployment | `development` | Gates staging | Runs, does not gate |
| Continuous Deployment | `staging` | Gates production | Runs, does not gate |
| Continuous Deployment | `production` | Not run | Not run |

Platform E2E is a step in `_build-deploy.yml`, so a failure fails the deploy. Module E2E runs in
`_moduleE2E.yml`. Its first job runs
[`scripts/listE2eModules.ts`](https://github.com/govuk-once/flex/blob/main/scripts/listE2eModules.ts),
which lists every directory in `domains/` whose `package.json` has a `test:e2e` script. Each domain
then gets its own job, named `Module E2E (<domain>)`, and one failing domain does not cancel the
others. See [Pipeline](/flex/delivery/pipeline/#platform-e2e-and-module-e2e) for what a failure
blocks.

## How a suite finds the stage

Both kinds use the shared global setup, `@flex/testing/e2e/setup`. Before any test runs, it works
out:

| Value | Where it comes from |
| --- | --- |
| Stage | `STAGE`, then `USER`, then `development`, sanitised as a [stage name](/flex/delivery/environments/#stage-names) |
| Public API URL | The `FlexApiUrl` output of `<stage>-FlexGlobal`, in us-east-1 |
| Private API Gateway URL | The `PrivateGatewayUrl` output of `<stage>-FlexPlatform`, in eu-west-2 |
| Access token | For `staging` and `production`, a real sign-in of the test user in the Secrets Manager secret `/<stage>/flex-secret/e2e/test_user`. For every other stage, a stub token signed with the key in `/development/flex-secret/auth/e2e/private_jwk` |
| WAF bypass token | The Secrets Manager secret `/<stage>/flex-secret/waf/e2e-bypass`, created by the global stack |

The `authHeader` fixture sends the access token and the bypass token, in the `x-flex-e2e-bypass`
header, so the CloudFront web ACL's IP reputation rules do not block test traffic.

The setup always needs AWS credentials for the stage's account, even when you give it the URLs,
because it reads the token secrets.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `STAGE` | `USER`, then `development` | The stage to test |
| `AWS_REGION` | Set by gds-cli | Region for Secrets Manager and SSM. Set `eu-west-2` if you do not use gds-cli |
| `FLEX_API_URL` | From stack outputs | Public API URL. Set it with `FLEX_PRIVATE_GATEWAY_URL` and `STAGE` to skip the CloudFormation lookup |
| `FLEX_PRIVATE_GATEWAY_URL` | From stack outputs | Private API Gateway URL. Set it with `FLEX_API_URL` and `STAGE` |

If you set either URL, you must set both URLs and `STAGE`, or the setup stops with an error.

## Running locally

Deploy a stage first. See [Environments](/flex/delivery/environments/#deploying-by-hand). Then
assume a role for that stage's account. See
[AWS credentials](/flex/start/environment-setup/#aws-credentials).

```bash
pnpm --filter @flex/e2e test:e2e:platform                      # your personal stage
STAGE=development pnpm --filter @flex/e2e test:e2e:platform    # another stage
pnpm --filter @flex/udp-domain test:e2e                         # one domain's module suite
pnpm test:e2e                                                   # every domain's module suite
```

`test:e2e:platform` runs `vitest`, which starts in watch mode in a terminal. Press `q` to quit, or
add `--run` to run once.

To avoid typing variables, copy `tests/e2e/.env.example` to `tests/e2e/.env` and fill it in. The
setup loads `.env` from the directory the tests run in.

```bash
STAGE=development
AWS_REGION=eu-west-2
```

## Structure

```text
tests/e2e/
  .env.example
  vitest.config.ts        global setup, 40 second test timeout
  src/platform/
    auth.test.ts
    private-gateway.test.ts
    security-headers.test.ts
```

Platform tests import `it` from `@flex/testing/e2e`, which adds the `cloudfront`, `docs`,
`privateGateway` and `authHeader` fixtures, and read the resolved values with
`inject("e2eEnv")`:

```ts
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("security headers", () => {
  it("applies the strict response headers to API responses", async ({
    cloudfront,
    authHeader,
  }) => {
    const result = await cloudfront.client.get("/health", { headers: authHeader });

    expect(result.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
```

The private API Gateway is reachable only from inside the VPC, so `private-gateway.test.ts` checks
that a request from the internet fails. Service gateways sit behind it and cannot be called
directly from a test. They are exercised through the domain routes that use them.

## Guidelines

- Tests run against real infrastructure. Make each test independent and idempotent, and test a
  whole user journey.
- Do not mutate shared state that another test, or another person, relies on.
- Name tests after the scenario they check.
- Platform tests time out after 40 seconds. Module suites use Vitest's default unless their
  `vitest.e2e.config.ts` sets `testTimeout`.
