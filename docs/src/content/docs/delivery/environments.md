---
title: Environments
description: The stages Flex deploys to, the stacks each one gets, and how to deploy, compare, hotswap and destroy by hand.
---

Flex is one CDK app, in `platform/infra/flex`, synthesised for one stage at a time. The stage
decides the stack names, which AWS account and shared resources the stacks use, and which domains
and routes are deployed. See [Infrastructure](/flex/infrastructure/overview/) for what each stack
creates.

## Stages

| Environment | Stage | Persistent | AWS account | Deployed by | API URL |
| --- | --- | --- | --- | --- | --- |
| Personal | your `$USER` | No | development | You, from your machine | `https://<stage>.<hosted zone>` |
| Pull request | `pr-<number>` | No | development | The pull request pipeline | `https://<stage>.<hosted zone>` |
| Development | `development` | Yes | development | The main pipeline | `https://<hosted zone>` |
| Staging | `staging` | Yes | staging | The main pipeline, after approval | `https://<hosted zone>` |
| Production | `production` | Yes | production | The main pipeline, after approval | `https://<hosted zone>` |

The hosted zone name is read from the SSM parameter `/infra/dns/hostedzonename` in each account.
The URL a stage actually got is the `FlexApiUrl` output of its `<stage>-FlexGlobal` stack.

### Stage names

`getEnvConfig()` in `@flex/utils` reads the stage from `STAGE`, falling back to `USER`. It
lowercases the value, removes every character other than `a-z`, `0-9` and `-`, and keeps the first
12 characters. A user called `Jane.Smith-Jones` deploys the stage `janesmith-jo`.

A stage is persistent only when it is exactly `development`, `staging` or `production`. Every
other stage is ephemeral and belongs to the `development` environment: it reads its parameters from
`/development/...` and reuses the development network.

## Core and stage stacks

Persistent environments own their shared infrastructure. Ephemeral stages borrow development's.

| Stack | Deployed for | Region |
| --- | --- | --- |
| `<env>-FlexCore` | Persistent stages only | eu-west-2 |
| `<env>-FlexSmokeTest` | Persistent stages only | eu-west-2 |
| `<env>-FlexCloudWatchDashboards` | Persistent stages only | eu-west-2 |
| `<env>-FlexMacie` | Persistent stages only | eu-west-2 |
| `<stage>-FlexPlatform` | Every stage | eu-west-2 |
| `<stage>-FlexGlobal` | Every stage | us-east-1 |
| `<stage>-<domain>` | Every stage, one per domain | eu-west-2 |
| `<stage>-FlexApiDeployment` | Every stage | eu-west-2 |

An ephemeral stage imports the VPC, security groups, alarm topics and API Gateway VPC endpoint
that `development-FlexCore` exports to SSM. If that stack is missing, a personal or pull request
deploy fails.

Persistent and ephemeral stages also differ in what they deploy. An ephemeral stage deploys every
domain, route and service gateway. A persistent stage deploys only those whose `environments`
include it. See [Domain configuration](/flex/domains/configuration/).

## Deploying by hand

You need AWS credentials for the target account. See
[AWS credentials](/flex/start/environment-setup/#aws-credentials). Run these from the repository
root.

```bash
pnpm run deploy                          # every stack for your personal stage
domain=udp pnpm run deploy               # only the udp domain stack, plus the shared stacks
STAGE=development pnpm run deploy        # a named stage
domain=udp STAGE=development pnpm run deploy
```

Use `pnpm run deploy`, not `pnpm deploy`. `deploy` is also a built-in pnpm command, and pnpm runs
the built-in in preference to the script.

The script runs `pnpm openapi:generate`, then `cdk deploy --all --concurrency 4
--require-approval never` in `@platform/flex`. CDK does not stop to ask about IAM or security group
changes, so run a [diff](#diff) first when a change touches them.

With `domain=<name>` set, only that domain's stack is synthesised. Every other stack in the app,
such as the platform, global and API deployment stacks, still deploys.

### Diff

```bash
pnpm --filter @platform/flex run diff
```

This compares every stack for the current stage with what is deployed. `STAGE` and `domain` work
as they do for a deploy.

The package scripts (`diff`, `hotswap`, `destroy`, `synth`) do not generate the OpenAPI documents.
The global stack uploads whatever is in `dist/openapi/current`, so run `pnpm openapi:generate`
first if that directory is missing or out of date.

### Hotswap

A hotswap updates Lambda function code in place, without a CloudFormation deployment. It takes
seconds rather than minutes.

```bash
domain=udp pnpm --filter @platform/flex run hotswap <stage>-udp
```

Name the stacks to hotswap. The app has many stacks, and `cdk deploy` without `--all` refuses to
pick one.

CDK skips any change it cannot hotswap instead of falling back to a full deployment. Use a hotswap
only for Lambda code changes. Anything else leaves the deployed resources out of step with the
template until the next full deploy.

`pnpm --filter @platform/flex run dev` runs `cdk watch`, which hotswaps on every file change. It
needs stack names in the same way.

### Destroy

```bash
pnpm --filter @platform/flex run destroy
```

This runs `cdk destroy --all` for the current stage and asks you to confirm. Destroy your personal
stage when you no longer need it. The pull request pipeline destroys `pr-<number>` stacks when the
pull request closes.

Never run it with `STAGE` set to a persistent stage. For a persistent stage the app includes the
core stack.

## Deploying to persistent environments

The [Continuous Deployment pipeline](/flex/delivery/pipeline/) is the route into development,
staging and production. Deploying to them by hand bypasses quality checks, versioning, E2E tests
and approvals, and the next pipeline run replaces whatever you deployed.

- **Production:** only through the pipeline. Deploying from a workstation needs break-glass
  production access and is reserved for an incident. See [Fix forward](/flex/runbooks/fix-forward/).
- **Staging and development:** avoid it. If you must, tell the team, and land the same change
  through `main` straight afterwards.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `STAGE or USER env var not set` | Neither variable is set, often in a container or CI shell | Set `STAGE` |
| A personal or pull request deploy cannot find a VPC, security group or SSM parameter | `development-FlexCore` is missing, or your credentials are for another account | Check you are in the development account and that development's core stack is deployed |
| `pnpm deploy` prints pnpm's own usage or errors | pnpm ran its built-in `deploy` command | Use `pnpm run deploy` |
| `Since this app includes more than a single stack, specify which stacks to use` | `hotswap` or `dev` was run without stack names | Name the stacks, such as `<stage>-udp` |
| `Stack ... is in UPDATE_IN_PROGRESS state and can not be updated` | Another deploy to the same stage is running. Pipeline runs are not serialised | Wait for it to finish, then deploy or re-run |
| E2E tests cannot find the API | Stack outputs are missing or you are in the wrong account | Check the outputs, below |

To check a stage's stack outputs:

```bash
aws cloudformation describe-stacks --stack-name <stage>-FlexPlatform \
  --query 'Stacks[0].Outputs'
aws cloudformation describe-stacks --stack-name <stage>-FlexGlobal --region us-east-1 \
  --query 'Stacks[0].Outputs'
```
