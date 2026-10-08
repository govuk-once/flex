---
title: Security scanning
description: The security checks that run on every change and after every deploy, what each one fails on, and how to deal with a vulnerability.
---

Most checks run in the [quality checks](/flex/delivery/pipeline/#quality-checks) on every pull
request and every push to `main`. The ZAP scan runs against staging after the pipeline succeeds.

| Check | Runs in | Fails the build on |
| --- | --- | --- |
| detect-secrets, detect-private-key | Hygiene job, as pre-commit hooks | A secret not in `.secrets.baseline`, or a private key |
| [Macie coverage](#macie-coverage) | Hygiene job | Never. It warns and posts to Slack |
| [SonarQube](#sonarqube) | SonarQube job | A failed quality gate |
| [checkov](#checkov) | Security job | A failed checkov check |
| [Dependency review](#dependency-review) | Security job | A new dependency with a high or critical vulnerability |
| [IAM Access Analyzer](#iam-access-analyzer) | Security job | An IAM policy error or security warning, or access the checks forbid |
| OpenAPI breaking changes | Validate OpenAPI Spec, on pull requests | A breaking API change. See [OpenAPI](/flex/domains/openapi/) |
| [ZAP](#zap) | ZAP API scan, after deploys | Nothing. Findings go into the report |

The pre-commit hooks are described in [Conventions](/flex/start/conventions/).
[Dependabot](https://github.com/govuk-once/flex/blob/main/.github/dependabot.yml) opens weekly,
grouped patch and minor updates for npm packages and GitHub Actions, for releases at least seven
days old.

## SonarQube

The SonarQube job runs every package's unit tests with coverage, then the SonarQube scan, and waits
up to two minutes for the quality gate. Its configuration is
[`sonar-project.properties`](https://github.com/govuk-once/flex/blob/main/sonar-project.properties):
source and test paths, coverage exclusions, duplication exclusions and accepted rules, each with a
comment saying why. Add to those lists with a reason, rather than lowering the gate.

## checkov

`pnpm run checkov` runs the `checkov` script of every affected project. Only `@platform/flex` has
one. It synthesises the CDK app and scans the CloudFormation templates in `cdk.out`. Checks skipped
for the whole app are in `platform/infra/flex/checkov.yaml`.

To skip a check for one resource, add checkov metadata with
`applyCheckovSkip(construct, "CKV_AWS_…", "reason")` from
`platform/infra/flex/src/utils/applyCheckovSkip.ts`. Always give the reason.

## Dependency review

GitHub's dependency review compares the dependencies of the pull request's base and head, and fails
on a vulnerability of high severity or above. Licence checks are off. On a push to `main` it
compares `main` with itself, so it finds nothing there: the pull request is where it counts.

## IAM Access Analyzer

After `cdk synth`, the Security job runs
[cfn-policy-validator](https://github.com/awslabs/aws-cloudformation-iam-policy-validator) on each
`*-FlexPlatform.template.json`. The domain stacks are not checked.

| Command | Fails on |
| --- | --- |
| `validate` | IAM Access Analyzer errors and security warnings. `MISSING_ARN_FIELD` and `DATA_TYPE_MISMATCH` are ignored as false positives |
| `check-access-not-granted` | Any policy granting `iam:PassRole`, `kms:Decrypt`, `kms:*` or `lambda:InvokeFunction` |
| `check-no-public-access` | Any resource policy that makes a resource public |

API Gateway needs `lambda:InvokeFunction` on the service gateway functions and the JWKS stub, and
the JWKS endpoint is public on purpose, so those resources are excluded by logical ID in
`_quality-checks.yml`. A new service gateway function needs the same exclusion. Findings from
unresolved `Fn::ImportValue` references are ignored too.

## Macie coverage

`pnpm run validate:macie-coverage` compares the domains in `domains/` with `coveredDomains` in
[`platform/infra/flex/src/macie-coverage.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/macie-coverage.ts).
For each domain not listed, review the data it handles, add any personal data format Macie does not
recognise to `customDataIdentifiers`, then add the domain to `coveredDomains`. A listed domain that
no longer exists produces a warning.

The check never fails the build. When domains are missing, it posts a "Flex Macie coverage gap"
message to the [release Slack channels](/flex/delivery/releases/#how-messages-reach-slack). See
[Data and encryption](/flex/infrastructure/data-and-encryption/) for what Macie scans.

## ZAP

`zap.yml` runs an [OWASP ZAP](https://www.zaproxy.org/) API scan against staging. It starts when a
Continuous Deployment run on `main` succeeds, which includes the production deploy, or when started
by hand.

1. It checks out `main`, whichever branch started it, and assumes the staging deployment role.
2. `pnpm dastSetup` (`scripts/dastSetup.ts`) signs in the staging E2E test user and puts
   `Bearer <token>` in `ZAP_AUTH_HEADER_VALUE`, which ZAP sends as the `Authorization` header.
3. [zaproxy/action-api-scan](https://github.com/zaproxy/action-api-scan) scans the routes in
   `.zap/merged-openapi.json` against the URL in the `STAGING_API_URL` secret, with ZAP's alpha
   rules included. `.zap/rules.tsv` holds rule overrides and is empty.

The scan raises no GitHub issues. Download its report from the bottom of the run's **Summary**
page.

`.zap/merged-openapi.json` is a committed snapshot of the dvla, udp and uns routes. It is not
regenerated by `pnpm openapi:generate`, so routes added since are not scanned until someone updates
it.

### Trying a change to the scan

A run started from a branch still checks out `main`. To try a change to the workflow from a branch,
point it at development:

1. In the Configure AWS credentials step, use `secrets.DEV_DEPLOYMENT_ROLE`.
2. In the Generate JWT step, set `STAGE` to `development`.
3. In the ZAP Scan step, replace `secrets.STAGING_API_URL` with the development API URL.
4. If you changed `.zap/` or `scripts/dastSetup.ts`, set the checkout `ref` to your branch.
5. Push, then run `gh workflow run zap.yml --ref <branch>`.

Revert these changes before merging.

To check an OpenAPI document imports cleanly, open it in the ZAP desktop app with **Import → Import
OpenAPI Definition**, with the target set to `localhost`.

## Vulnerabilities

Handle a vulnerability through the
[GDS Once vulnerability management process](https://gdsgovukagents.atlassian.net/wiki/spaces/GOS/pages/51806439/Vulnerability+Management+Process).
If you cannot follow it, raise a ticket in the project's Jira space to start triage and
remediation. For a leaked credential, see [Leaked secret](/flex/runbooks/leaked-secret/).
