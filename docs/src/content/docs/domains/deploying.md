---
title: Deploying and verifying
description: Deploy a domain and verify it works.
sidebar:
  order: 8
---

Deploy a domain to your own **personal stage** to try it in AWS, then check it works with the E2E tests or by hand. The shared environments are deployed by the pipeline when your pull request merges.

Everything here needs AWS access. See [Environment setup](/flex/getting-started/environment-setup/) first, and sign in with the GDS CLI.

## Stages

A **stage** is one complete copy of Flex. Every deploy, API URL and token belongs to one:

| Stage         | Deployed by                       | Domains                                                                         | Token                |
| ------------- | --------------------------------- | ------------------------------------------------------------------------------- | -------------------- |
| Personal      | You                               | All by default, or one with `domain=<name>`                                     | [Stub](#tokens)      |
| `pr-<n>`      | CI, for each pull request         | All                                                                             | [Stub](#tokens)      |
| `development` | The pipeline, after merge         | Those whose [`environments`](/flex/domains/domain-config/#top-level) include it | [Stub](#tokens)      |
| `staging`     | The pipeline, after `development` | Those whose `environments` include it                                           | [One Login](#tokens) |
| `production`  | The pipeline, after `staging`     | Those whose `environments` include it                                           | [One Login](#tokens) |

Your personal stage is named after `$USER`, lower-cased, with anything other than letters, numbers and hyphens removed, and cut to 12 characters. Set `STAGE=<name>` to use another name. Everything is named after the stage, such as the `<stage>-FlexPlatform` stack.

Personal and `pr-<n>` stages share the `development` environment's core infrastructure. They are isolated from the shared environments, so deploy and break things freely.

## Deploy

```bash
# Deploy every domain
pnpm run deploy

# Deploy one domain
domain=<name> pnpm run deploy
```

`pnpm run deploy` generates the OpenAPI specs, then deploys every CDK stack for your stage.

With `domain=<name>`, only that domain's stack is deployed. The platform, global and API deployment stacks are always part of a deploy. Use it to deploy only the domain you are working on.

### Preview and iterate

```bash
# Show what a deploy would change
pnpm --filter @platform/flex diff

# Update Lambda code without a full CloudFormation deploy
pnpm --filter @platform/flex hotswap
```

Use `hotswap` for code changes only. A change to the config or any infrastructure needs a full deploy.

### Tear down

Remove your stage when you are done with it:

```bash
pnpm --filter @platform/flex destroy
```

## Pull request stages

When you open a pull request, CI deploys a `pr-<n>` stage, runs every domain's E2E tests against it, and destroys the stage when the pull request is closed or merged. The E2E check isn't a required check, so look at the result yourself.

## Verify it works

### Run the E2E tests

```bash
pnpm --filter @flex/<name>-domain test:e2e
```

The tests find your stack from its CloudFormation outputs and fetch their own token. See [Testing](/flex/domains/testing/#end-to-end-tests).

### Make a request by hand

Find your API URL. It is the `FlexApiUrl` output of the `<stage>-FlexGlobal` stack, which is in `us-east-1`. This command works out your stage name the same way the deploy does (see [`sanitiseStageName`](https://github.com/govuk-once/flex/blob/main/libs/utils/src/infra/index.ts)), then reads the output:

```bash
STAGE=$(printf '%s' "$USER" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-' | cut -c1-12)

aws cloudformation describe-stacks \
  --region us-east-1 \
  --stack-name "${STAGE}-FlexGlobal" \
  --query "Stacks[0].Outputs[?OutputKey=='FlexApiUrl'].OutputValue" \
  --output text
```

If you deploy with a different `STAGE`, set it yourself instead of working it out from `$USER`.

Generate a token. The script prints some progress text and then the token, so copy just the token:

```bash
pnpm jwt
export TOKEN=<token>
```

Then call a route. Public routes are under `/app`:

```bash
curl -H "Authorization: Bearer $TOKEN" "<FlexApiUrl>/app/<domain>/<version>/<path>"
```

Private routes can't be called this way. See [Private routes](/flex/domains/testing/#private-routes).

### Tokens

| Stages                               | Token                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Personal, `pr-<n>` and `development` | A stub token, signed with a stub key and accepted because these stages use a stub JWKS endpoint. |
| `staging` and `production`           | A real token, from signing a test user in to GOV.UK One Login.                                   |

`pnpm jwt` makes the right kind for the stage in `STAGE`, and uses `development` if it is not set. Stub tokens expire after one hour, so generate another when you get a `401`.

See [How Flex works](/flex/introduction/how-flex-works/#2-authorizer) for how the authorizer checks a token.

## If it doesn't work

See [Troubleshooting](/flex/getting-started/troubleshooting/), including what to do when your AWS credentials have expired.
