---
title: Pipeline
description: Every GitHub Actions workflow, the pull request pipeline, and how a change moves from main to production.
---

Flex is built, tested and deployed by GitHub Actions. The workflows live in `.github/workflows/`.
A merge to `main` is the only route into staging and production. If this page and
[`main.yml`](https://github.com/govuk-once/flex/blob/main/.github/workflows/main.yml) disagree,
the workflow is right: fix the page.

## Workflows

| File | Name in Actions | Runs on | What it does |
| --- | --- | --- | --- |
| `ci-pr-quality-checks.yml` | Release Candidate | Pull request to `main` opened, pushed to or reopened | [Quality checks](#quality-checks), and a deploy of the pull request's own stage with its E2E tests |
| `ci-pr-title-check.yml` | Validate PR Title | Pull request to `main` opened, edited, pushed to or reopened | Checks the title format and comments on the pull request. Skipped for Dependabot |
| `ci-pr-validate-openapi.yml` | Validate OpenAPI Spec | Pull request to `main`, including labelling | Fails on a breaking API change. See [OpenAPI](/flex/domains/openapi/) |
| `ci-pr-cleanup.yml` | Destroy Ephemeral Environment | Pull request closed or merged | Destroys the `pr-<number>` stacks |
| `main.yml` | Continuous Deployment | Push to `main`, or by hand | Quality checks, release, then development, staging and production |
| `zap.yml` | ZAP API scan | A successful Continuous Deployment run on `main`, or by hand | Scans staging. See [Security scanning](/flex/delivery/security-scanning/) |
| `performance-tests.yml` | Performance Tests | By hand only | See [Performance tests](/flex/delivery/performance-tests/) |
| `docs.yml` | Documentation | Changes to `docs/`, on a pull request or `main`, or by hand | Builds this site, and publishes it from `main` |

The workflows whose names start with `_` are reusable, called by the ones above:
`_quality-checks.yml`, `_build-deploy.yml` (deploy, then platform E2E), `_moduleE2E.yml`,
`_notify-deployment.yml` and `_validate-openapi.yml`.

The PR title format is set out in [Conventions](/flex/start/conventions/). The title becomes the
squash commit on `main`, which decides the [release version](/flex/delivery/releases/).

## Quality checks

`_quality-checks.yml` runs three jobs in parallel, on every pull request and every push to `main`.

| Job | Steps |
| --- | --- |
| Hygiene | pre-commit hooks on every file, lint, type check, `validate:integrations` (see [Integrations](/flex/domains/integrations/)), Macie coverage check |
| SonarQube | Every package's unit tests with coverage, then the SonarQube scan, waiting for the quality gate |
| Security | checkov, dependency review, `cdk synth`, IAM Access Analyzer policy checks |

Lint and type check run through `nx affected`, so they cover only the projects changed since the
last successful run on `main`. Unit tests always run in full. [Security
scanning](/flex/delivery/security-scanning/) describes the security and SonarQube checks.

## Pull request pipeline

Opening or pushing to a pull request against `main` runs **Release Candidate**:

```text
Quality Checks                      (in parallel with the deploy)
Ephemeral Environment branch tests  deploy stage pr-<number>, then platform E2E
  └─ Module E2E                     one job per domain with a test:e2e script
```

The pull request deploys to its own stage, `pr-<number>`, in the development account. A new push
waits for the current run to finish rather than cancelling it. When the pull request is closed or
merged, **Destroy Ephemeral Environment** runs `cdk destroy --all --force` for that stage.

The title check, the OpenAPI check and, when `docs/` changes, the documentation build also run on
the pull request.

## Continuous Deployment

A push to `main` starts **Continuous Deployment**. Each merge starts its own run.

```text
Quality Checks
  └─ Release
       └─ Deploy to Development          deploy, then platform E2E
            ├─ Module E2E (Development)
            └─ Deploy to Staging         approval, deploy, then platform E2E
                 ├─ Notify Staging Deployment
                 ├─ Module E2E (Staging)
                 └─ Deploy to Production approval, deploy
                      └─ Notify Production Deployment

Notify Deployment Failure runs when any deploy job fails.
```

| Job | Waits for | Approval | Blocks the next stage if it fails |
| --- | --- | --- | --- |
| Quality Checks (Hygiene, SonarQube, Security) | Nothing | No | Yes |
| Release | Quality Checks | No | Yes |
| Deploy to Development | Release | No | Yes |
| Module E2E (Development) | Deploy to Development | No | No |
| Deploy to Staging | Deploy to Development | Staging | Yes |
| Notify Staging Deployment | Deploy to Staging | No | No |
| Module E2E (Staging) | Deploy to Staging | No | No |
| Deploy to Production | Deploy to Staging | Production | Not applicable |
| Notify Production Deployment | Deploy to Production | No | No |
| Notify Deployment Failure | Any deploy job failing | No | No |

**Release** runs semantic-release, which may tag a new version. See
[Releases](/flex/delivery/releases/). Each deploy job runs `pnpm openapi:generate`, assumes the
environment's deployment role (`DEV_DEPLOYMENT_ROLE`, `STAGING_DEPLOYMENT_ROLE` or
`PROD_DEPLOYMENT_ROLE`) through OIDC, and runs `pnpm run deploy` in `platform/infra/flex`.

### Platform E2E and module E2E

The two kinds of E2E test gate the pipeline differently.

- **Platform E2E** is the last step of each deploy job, for every stage except production. A
  failure fails the deploy job, so development's platform E2E gates staging and staging's gates
  production.
- **Module E2E** runs in separate jobs that nothing depends on. A failure does not stop the
  promotion and does not send a failure notification. Production can deploy before Module E2E
  (Staging) has finished.
- **Production** runs neither.

A failed Module E2E job does mark the run as failed, so the ZAP scan, which needs a successful run,
does not start. [E2E tests](/flex/delivery/e2e-tests/) covers both suites.

### Approvals

Approvals are GitHub environment protection rules, set under the repository's **Settings →
Environments**, not in the workflow files.

| Environment | Required reviewers | Deploys from |
| --- | --- | --- |
| `development` | None | Any branch |
| `staging` | `govuk-once-flex-developers` | Protected branches only |
| `production` | `govuk-once-flex-developers` | Protected branches only |

Anyone in `govuk-once-flex-developers` can approve, including the person who merged the change.
There is no wait timer. A job waits at its gate until someone approves or rejects it, and GitHub
fails a job left waiting for 30 days.

To approve:

1. Open **Actions → Continuous Deployment** and the run. A run at a gate shows **Waiting** and a
   **Review deployments** button.
2. Select **Review deployments**, tick the environment, optionally add a comment, then select
   **Approve and deploy**. **Reject** stops the run at that stage.

Staging and production are separate approvals. The production prompt appears only once Deploy to
Staging, including its platform E2E, has passed. Re-running a staging or production deploy job asks
for approval again.

### What to check before approving

Runs are not queued against each other. If an older run is still waiting at a gate after a newer
one has deployed, approving the older run puts older code back into that environment. Approve only
the newest run, and reject older ones that are waiting.

Before approving staging:

- Deploy to Development is green.
- Module E2E (Development) is green, or you understand why it is not.

Before approving production:

- Deploy to Staging is green.
- Module E2E (Staging) has finished and is green. It may still be running when the prompt appears.
- Staging alerts are quiet. See [Alarms](/flex/observability/alarms/).
- Do not approve to clear a queue. Nothing tests production automatically after this point.

### Reading a run

| State | What you see | Meaning |
| --- | --- | --- |
| In progress | A job shows a spinner | Normal. A deploy takes several minutes per stage |
| Waiting | Deploy to Staging or Deploy to Production is waiting, with a **Review deployments** button | Waiting for an approval, not stuck |
| Succeeded | All jobs green | The change is live in every environment |
| Failed | A red job | The run stopped at that stage, unless only a Module E2E job failed |

The GitHub run is the record of what happened:

```bash
gh run list --workflow=main.yml -L 5
```

Slack gets a message when staging or production deploys, and when any deploy job fails. A
successful development deploy is silent. Notifications are best effort, so the absence of a
message proves nothing. See [Releases](/flex/delivery/releases/#deployment-notifications).

### Re-running and manual runs

| To | Do |
| --- | --- |
| Re-run what failed and keep what passed | Run page → **Re-run failed jobs**, or `gh run rerun <run-id> --failed` |
| Re-run the whole run | Run page → **Re-run all jobs**, or `gh run rerun <run-id>` |
| Run the pipeline on the current `main` without a new merge | **Actions → Continuous Deployment → Run workflow** on `main`, or `gh workflow run main.yml --ref main` |

A new push to `main` starts a fresh run from the beginning. It does not resume a failed run.

A manual run starts again from Quality Checks. If there is nothing releasable since the last tag,
Release creates no version and the deploys still run. Start it on `main` only: on another branch,
Deploy to Development would deploy that branch, because development accepts any branch.

CDK deploys converge on the template, so re-running a deploy is safe.

### When a run fails

Open the first red job and expand the failing step. Decide whether the failure is transient, such
as throttling or a runner problem, or real.

- **E2E failures** are often a problem in a service the tests depend on rather than the change.
  Look for a dependency the failing tests share, then re-run failed jobs. If it fails the same way
  twice, stop re-running and investigate.
- **CloudFormation failures** say little in the Actions log. Read the stack events in the
  CloudFormation console. Re-running rarely helps until you know the cause.

| Failing stage | Where to look | Common causes |
| --- | --- | --- |
| Quality Checks, Hygiene | pre-commit, lint, type check or `validate:integrations` step | Lint or type error, a detected secret, an integration pointing at a route that no longer exists |
| Quality Checks, SonarQube | Unit test step and the SonarQube scan | Failing test, quality gate failed |
| Quality Checks, Security | checkov, dependency review or IAM Access Analyzer step | New infrastructure finding, high-severity dependency, risky IAM policy |
| Release | Run semantic release step | Bad commit history or a token permission problem. See [Releases](/flex/delivery/releases/#troubleshooting) |
| Deploy to an environment | Deploy FLEX AWS infra step, then the CloudFormation console | CloudFormation error, another deploy in progress, OIDC or IAM problem, a missing SSM parameter |
| Platform E2E | Platform E2E tests step in the deploy job | A regression, or missing stack outputs |
| Module E2E | The domain's matrix job | A domain regression or a test data problem. Does not stop the pipeline |
| Notify | The notify job | SNS or SSM access. Cosmetic only |

A failure at or before a gate means nothing has gone past that gate. To stop a promotion, fix
forward or roll back, see [Fix forward](/flex/runbooks/fix-forward/).

### Checking a deploy worked

- **Development and staging:** platform E2E is the check, and module E2E covers the domains.
- **Production:** no tests run. A green Deploy to Production means CloudFormation applied the
  change, not that the service is healthy. Watch the production alerts for at least ten minutes
  after the deploy. If an alert fires soon after, assume the deploy caused it until you know
  otherwise. See [Alarms](/flex/observability/alarms/) and
  [Verify environment health](/flex/runbooks/verify-environment-health/).
