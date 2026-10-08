---
title: Infrastructure
description: The CDK app in platform/infra/flex, the stacks it builds, how stacks share values over SSM, and how to change it.
---

Flex deploys with AWS CDK from one app, the `@platform/flex` package in `platform/infra/flex`. Its
entry point is [`src/app.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/app.ts),
which `cdk.json` runs with `tsx`. Every stack, for every stage, comes from this app.

## What the app does

When CDK synthesises the app, `app.ts`:

1. Reads the stage with `getEnvConfig()` (see [Stage and environment](#stage-and-environment)).
2. Loads every `domains/*/domain.config.ts` and every `platform/domains/*/gateway.config.ts`.
   There is no list of domains or gateways to keep up to date.
3. Drops the domains, routes and gateways whose `environments` exclude the stage. Personal and PR
   stages get everything.
4. Registers the SSM parameters that come from outside the app (see
   [Values from outside the app](#values-from-outside-the-app)).
5. Creates the stacks below, then adds the dependencies between them that the SSM imports imply.

Two app-wide [aspects](https://docs.aws.amazon.com/cdk/v2/guide/aspects.html) run over every
stack. `EnforceS3Https` adds a bucket policy statement to every S3 bucket that denies any request
not made over TLS. `EncryptLogGroups` sets a customer managed KMS key on every log group that has
none; see [Data and encryption](/flex/infrastructure/data-and-encryption/).

## Stacks

| Stack | Name | Region | Built for | What it creates |
| --- | --- | --- | --- | --- |
| `FlexCoreStack` | `<env>-FlexCore` | eu-west-2 | Persistent environments | The VPC (three availability zones, public, private egress and private isolated subnets, three NAT gateways), network ACLs, VPC flow logs, the `PrivateEgress` and `PrivateIsolated` security groups, interface endpoints for API Gateway, CloudWatch Logs, Secrets Manager, SSM, STS and KMS, the API Gateway CloudWatch role, the alarm SNS topics and their Slack channel, the release notifications topic (development only), the log group KMS key and the DVLA secret rotation function. Termination protection is on. |
| `FlexSmokeTestStack` | `<env>-FlexSmokeTest` | eu-west-2 | Persistent environments | A scheduled smoke test function and its alarm. See [Alarms](/flex/observability/alarms/). |
| `FlexCloudWatchDashboardsStack` | `<env>-FlexCloudWatchDashboards` | eu-west-2 | Persistent environments | The driving and UDP dashboards, from the JSON in `src/dashboards/`. |
| `FlexPlatformStack` | `<stage>-FlexPlatform` | eu-west-2 | Every stage | The public REST API (`/health` and `/app`) with its regional WAF, the Lambda authorizer, a JWKS stub in the development environment, the private REST API (`/domains` and `/gateways`), every service gateway, the alarms for both APIs and the permissions boundary for its functions. |
| `FlexGlobalStack` | `<stage>-FlexGlobal` | us-east-1 | Every stage | The certificate, the CloudFront distribution and its two CloudFront Functions, the CloudFront WAF, the CloudFront access log bucket, the OpenAPI spec bucket and the Swagger UI under `/docs`, the Route 53 alias record, Shield protection (not in the development environment) and the alarm relay. |
| `FlexMacieStack` | `<env>-FlexMacie` | us-east-1 | Persistent environments | A Macie session and a weekly scan of the CloudFront access log bucket. See [Data and encryption](/flex/infrastructure/data-and-encryption/). |
| `FlexDomainStack` | `<stage>-<domain>` | eu-west-2 | Every stage, one per domain | A Lambda function per route, and its method on the public or private API. |
| `FlexApiDeploymentStack` | `<stage>-FlexApiDeployment` | eu-west-2 | Every stage | API Gateway deployments of the public then the private API's `prod` stage, after every domain stack, with a six-second pause between the two. |

The request path through these resources is described in
[The platform](/flex/start/platform/). Alarms, the alarm relay, the smoke test and the dashboards
are described in [Alarms](/flex/observability/alarms/).

Setting `domain` when you deploy limits the domain stacks to that one domain. The other stacks are
built as usual. See [Environments](/flex/delivery/environments/) for deploying.

## Stage and environment

Every stack name starts with either the stage or the environment.

- The **stage** is the name of one deployment: `development`, `staging`, `production`, a personal
  stage such as `jsmith`, or a PR stage such as `pr-123`.
- The **environment** is the persistent environment the stage belongs to. A persistent stage is
  its own environment. Every other stage belongs to `development`.

Stacks that exist once per environment, such as the VPC, take the environment's name. Stacks that
exist once per deployment take the stage's name. How stages are named and when each is deployed is
described in [Environments](/flex/delivery/environments/).

### `getEnvConfig`

`getEnvConfig()` from `@flex/utils` returns both:

```typescript
import { getEnvConfig } from "@flex/utils";

const { env, stage, persistent } = getEnvConfig();
// STAGE=pr-123 → { env: "development", stage: "pr-123", persistent: false }
// STAGE=staging → { env: "staging", stage: "staging", persistent: true }
```

It reads `STAGE`, falling back to `USER`, lowercases it, removes anything that is not a letter,
digit or hyphen, and keeps the first 12 characters. It throws if neither variable is set.
`persistent` is true for `development`, `staging` and `production` only.

### Personal and PR stages

A personal or PR stage builds only the stage stacks: platform, global, domain and API deployment.
It shares the development environment's core stack, so it imports the development VPC, security
groups, API Gateway VPC endpoint, alarm topics and alarm topic key over SSM.

## Sharing values between stacks

Stacks never reference each other's constructs directly. A stack writes a value to an SSM
parameter, and another stack reads it. The app keeps track of who writes and who reads each
parameter, and orders the stacks to match.

This is built into the two base classes in
[`src/base/index.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/base/index.ts).
`SsmApp` is the CDK app. Every stack extends `BaseStack`, which must be created inside an `SsmApp`.

| Method | What it does |
| --- | --- |
| `this.export(key, value)` | Writes `value` to the SSM parameter `key` and records this stack as its writer. |
| `this.exports({ [key]: value })` | Calls `export` for each entry. |
| `this.import(key, region?)` | Reads the parameter `key`, by default from the stack's own region, and records this stack as a reader. |
| `this.exportVpc(key, vpc)` / `this.importVpc(key)` | Writes or reads a VPC as a set of parameters under `key`: ID, CIDR, availability zones, and subnet and route table IDs for each subnet type. |
| `this.importSecurityGroup(key, region?)` | Reads a security group ID and returns an `ISecurityGroup`. |
| `this.importInterfaceVpcEndpoint(key, region?)` | Reads a VPC endpoint ID and returns an interface endpoint on port 443. |

```typescript
import type { Construct } from "constructs";

import { BaseStack } from "../base";
import { ENV_KEYS, STAGE_KEYS } from "../ssm-keys";

export class ExampleStack extends BaseStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: { region: "eu-west-2" },
    });

    const vpc = this.importVpc(ENV_KEYS.Vpc);
    const criticalTopicArn = this.import(ENV_KEYS.TopicCriticalAlarms);

    // A value in us-east-1 read from eu-west-2 goes through a custom resource
    const restApiId = this.import(STAGE_KEYS.ApigwPublicRestId, "eu-west-2");
  }
}
```

The app checks every import and export while it synthesises:

- Exporting a key that another stack, or the outside world, already provides fails.
- Importing a key that no stack in the app exports, and that is not registered as external,
  fails.
- An import that would create a cycle between stacks fails.
- Otherwise the reader gets a CloudFormation dependency on the writer. Synth prints the resulting
  dependency tree.

A read in the stack's own region resolves the parameter when CloudFormation deploys the stack. A
read from another region goes through an `AwsCustomResource` that calls `ssm:GetParameter` in that
region on every deploy. The global and Macie stacks in us-east-1 read eu-west-2 values this way.

A stack can also list stacks it depends on by name, with `dependencies` in its props. The API
deployment stack uses this to wait for every domain stack.

### Parameter keys

Every key is a constant in
[`src/ssm-keys.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/ssm-keys.ts).
Add a key there rather than writing the path inline.

| Group | Path | Written by | Example |
| --- | --- | --- | --- |
| `PLATFORM_KEYS` | `/infra/dns/*` | The platform team, outside this repository | `/infra/dns/hostedzonename` |
| `ENV_KEYS` | `/<env>/flex-param/*` | The `flex-params` repository | `/development/flex-param/auth/user-pool-id` |
| `ENV_KEYS` | `/<env>/flex/*` | The core stack | `/development/flex/sg/private-egress` |
| `SMOKE_TEST_KEYS` | `/<env>/flex/smoke-test/*` | Outside this app; read by the smoke test at run time | `/staging/flex/smoke-test/firebase-app-id` |
| `STAGE_KEYS` | `/<stage>/flex/*` | The platform and global stacks | `/pr-123/flex/apigw/private/rest-api-id` |
| `STAGE_KEYS` | `/<stage>/flex-secret/*` | The platform stack (a Secrets Manager secret, not a parameter) | `/pr-123/flex-secret/origin-verify-secret` |

Domain and gateway `resources` name parameters and secrets under the same prefixes. See
[Resources](/flex/domains/resources/).

### Values from outside the app

Some parameters are written by something other than this app. `app.ts` registers them with
`app.addExternalExports(region, keys)` so imports of them pass the checks:

- the hosted zone ID and name, from the platform team
- the Cognito user pool and client IDs (real and stub), and the Slack workspace and channel IDs,
  from `flex-params`
- the release Slack channel IDs, in the development environment only
- every parameter a deployed service gateway's `resources` names
- for a personal or PR stage, the development core stack's exports listed in
  [Personal and PR stages](#personal-and-pr-stages)

Two values are read straight from SSM, outside these checks: the Lambda environment variable key
(`/<env>/flex-param/secret/encryption-key`) and the log group key ARN
(`/<env>/flex/kms/log-group-key-arn`).

## Tags

`BaseStack` tags every stack with `Environment` and `Stage`, plus the tags passed in its props.
`Product`, `System`, `Owner` and `ResourceOwner` are required; `Service`, `Source`, `Exposure`,
`DataClassification` and `CostCentre` are optional. They follow the
[GDS tagging guidance](https://gds-way.digital.cabinet-office.gov.uk/manuals/aws-tagging.html).

A domain stack takes `Owner` from the domain's `owner` setting (`N/A` if unset) and `ResourceOwner`
from its name. Each Lambda construct given a `domain` also tags its function with
`ResourceOwner`.

## Changing the infrastructure

### Where things live

```text
platform/infra/flex/
├── cdk.json             CDK settings and feature flags; runs src/app.ts with tsx
├── checkov.yaml         Checkov checks skipped for the whole app
└── src/
    ├── app.ts           Creates every stack
    ├── ssm-keys.ts      Every SSM key shared between stacks
    ├── macie-coverage.ts
    ├── aspects/         EnforceS3Https, EncryptLogGroups
    ├── base/            SsmApp, BaseStack and tag types
    ├── constructs/      Lambda, alarms, CloudFront, KMS, S3, Macie and CfnPause constructs
    ├── dashboards/      CloudWatch dashboard JSON
    ├── docs/            The Swagger UI page served under /docs
    ├── scripts/         validate-integrations and check-macie-coverage
    ├── stacks/          One file per stack; core/ is split by concern
    └── utils/           Route, resource, integration, gateway and permission helpers
```

### Adding a domain or a gateway

There is nothing to add here. A new `domains/<name>/domain.config.ts` gets its own domain stack,
and a new `platform/domains/<name>/gateway.config.ts` gets a function and a route in the platform
stack, the next time the app synthesises. See
[Creating a domain](/flex/domains/creating-a-domain/) and
[Creating a gateway](/flex/gateways/creating-a-gateway/). Other platform handlers, such as the
authorizer, are wired in by hand: see [Platform handlers](/flex/edge/platform-handlers/).

### Writing a stack

- Extend `BaseStack`, give it an explicit `env.region` (`eu-west-2` or `us-east-1`) and the
  required tags, and create it in `app.ts` with a name that starts with the stage or the
  environment.
- Get values from other stacks with `this.import`, never by passing constructs between stacks.
  Publish values other stacks need with `this.export`, under a key added to `ssm-keys.ts`.
- Create Lambda functions with the Flex constructs in
  [Lambda constructs](/flex/infrastructure/lambda-constructs/), so they get encryption, logging,
  tracing and alarms.

### Writing a construct

Group related resources in a construct in `src/constructs/`, or a function under
`src/stacks/core/` for the core stack. A construct takes what it needs as props, and exposes what
callers need as public read-only fields:

```typescript
import type { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import type { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export interface ExampleConstructProps {
  readonly vpc: IVpc;
  readonly securityGroup: ISecurityGroup;
}

export class ExampleConstruct extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: ExampleConstructProps) {
    super(scope, id);
    // Create resources with `this` as their scope
  }
}
```

A resource's logical ID comes from its construct path, so renaming a construct ID or moving a
resource to another scope replaces it. The global stack pins some logical IDs with
`overrideLogicalId`, such as the distribution's and the Shield protection's. Keep them.

### Accepting a Checkov finding

When a resource must break a Checkov rule, skip that rule on the resource and say why:

```typescript
import { applyCheckovSkip } from "../utils/applyCheckovSkip";

applyCheckovSkip(
  bucket,
  "CKV_AWS_18",
  "Log bucket intentionally does not log",
);
```

`applyCheckovSkips` takes several at once. Only add a rule to `checkov.yaml` when it applies to the
whole app.

### Permissions boundary

The platform and domain stacks apply a permissions boundary to every role they create. It allows
the baseline Lambda permissions (logs, X-Ray, VPC networking), reading secrets and parameters,
`kms:Decrypt` and `sts:AssumeRole`, and `execute-api:Invoke` on the private API only. It denies
`lambda:InvokeFunction`, so one function can only reach another through API Gateway. The core
stack applies its own boundary to the DVLA secret rotation function.

## Commands

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm --filter @platform/flex synth` | Synthesises every stack for the current stage into `cdk.out/`. |
| `pnpm --filter @platform/flex diff` | Compares the synthesised stacks with what is deployed. |
| `pnpm --filter @platform/flex checkov` | Synthesises quietly, then runs Checkov over `cdk.out/` with `checkov.yaml`. |
| `pnpm --filter @platform/flex dev` | Runs `cdk watch` over `src/` and every domain's and platform domain's `src/`. |
| `pnpm --filter @platform/flex validate:integrations` | Checks every domain integration resolves to a private route. See [Integrations](/flex/domains/integrations/). |
| `pnpm --filter @platform/flex validate:macie-coverage` | Lists domains missing from `macie-coverage.ts`. See [Security scanning](/flex/delivery/security-scanning/). |
| `pnpm --filter @platform/flex test` / `lint` / `tsc` | Unit tests, lint and type check. |

The package also has `deploy`, `hotswap` and `destroy` scripts. Deploying, hotswapping and
destroying a stage are described in [Environments](/flex/delivery/environments/), including
[Hotswap](/flex/delivery/environments/#hotswap).

Every command needs AWS credentials (see
[AWS credentials](/flex/start/environment-setup/#aws-credentials)) and a stage (see
[Environments](/flex/delivery/environments/)).

### Validating a change

Before you open a pull request that changes infrastructure, run `synth`, `checkov` and `diff`
against your own stage, and read the diff for replaced or deleted resources. CI synthesises the app
and runs Checkov on every pull request; see [Security scanning](/flex/delivery/security-scanning/).

A change to the core stack reaches every stage in the environment. Deploy it to `development`
first, and update the readers if you change an SSM key.
