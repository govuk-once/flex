# Deploying Flex

Repo: `govuk-once/flex`. Everything happens in GitHub Actions, under the Actions tab.

Merging to `main` starts a single pipeline run that takes the change through development, staging and
production. Development goes out on its own. Staging and production both stop and wait for someone to
approve them.

## Stages

| Stage                 | What has to pass first                        | What runs afterwards          |
| --------------------- | --------------------------------------------- | ----------------------------- |
| Quality checks        | Nothing                                       |                               |
| Deploy to Development | Quality checks                                | E2E tests against development |
| Deploy to Staging     | Development E2E tests, then a manual approval | E2E tests against staging     |
| Deploy to Production  | Staging E2E tests, then a manual approval     | Nothing                       |

Each gate blocks the next stage. The staging approval does not appear until the development E2E tests
have passed, and the production approval does not appear until the staging ones have. Nothing runs
automatically against production.

## Starting a deploy

Merge to `main`. That is the only trigger. The run shows up in the Actions tab straight away and
starts at quality checks.

The pipeline deploys from `main` and is the only route into any environment. You cannot use it to
deploy a branch, a tag or a local working copy, and if Actions is down the deploy waits.

These are all CloudFormation deployments, so in principle anyone with the right AWS permissions could
deploy to development or staging from their own machine. It is not an exercised process and is not
covered here. Production would need break glass access on top of that and should not be done.

## Re-running

Open the run and use **Re-run failed jobs**. It picks up from the stage that failed and keeps whatever
already passed, so you will not redeploy development again after a flaky E2E run.

Pushing a new commit to `main` starts a fresh run from the beginning. It will not resume the old one,
which stays failed.

Re-run if you think the failure was a flake. If it was CloudFormation, read the next section first.

## Approvals

Staging and production each pause at an approval step. The run waits there indefinitely and will not
deploy on its own if nobody looks at it.

Anyone in the `govuk-once-flex-developers` GitHub team can approve. Do it in the run itself: open the
pending run in the Actions tab and use the review prompt on the waiting job.

Before approving production, check that the staging E2E tests passed and that
`govuk-once-flex-alerting-staging` is quiet. Nothing is tested automatically after that point.

## When a run fails

The run stops at the first stage that fails, so that is the stage to open. Expand the failing step in
the job log.

**E2E failures** are usually a problem with one of the services the tests depend on rather than with
the change itself. Look at whether the failing journeys have a dependency in common, then re-run
failed jobs. If it fails the same way twice, stop re-running and investigate.

**CloudFormation failures** are rare and hard to diagnose. The Actions log usually will not tell you
much, so go to the CloudFormation console and read the stack events for the stack that failed.
Re-running rarely helps until you know what went wrong.

CloudFormation should roll the stack back by itself when a deployment fails. Check in the console that
it has, and that the stack has finished rolling back rather than sitting in a failed or in-progress
state. A stack stuck part way through needs someone to sort it out.

We fix forward. There is no step that redeploys the previous commit. Once you know the cause, the fix
goes to `main` as a new commit and runs through the pipeline from the start.

## Checking the deploy worked

**Development and staging:** the E2E suite is the check. If it is green there is nothing else to do.

**Production:** the E2E tests do not run here, so this is monitoring rather than testing. Once the
production stage goes green, watch `govuk-once-flex-alerting-production` in Slack. The alarms evaluate
over five minute periods, so anything they cover will show up in the first ten minutes or so. Stay
with it that long before you call the deploy done. If an alert fires shortly after a deploy, assume
the deploy caused it until you know otherwise.

CloudWatch is the place to look if you want more detail than the alerts give you. It is the only
dashboard worth checking.

The staging and development alerting channels exist as well, but they are noisier and less useful.
