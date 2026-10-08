---
title: Fix forward
description: How to halt a promotion, fix forward, and as a last resort roll back, when a change breaks an environment.
---

Use this runbook when a change has broken, or is about to break, an environment. It is written for
whoever is on call, including someone who has not done it before. For the incident process that
applies to every runbook, see [Runbooks](/flex/runbooks/overview/).

Flex deploys forward only. The pipeline has no step that redeploys an earlier version. Recovering
means shipping a new change, the fix forward, through the [pipeline](/flex/delivery/pipeline/).
Reverting the bad commit is a fix forward too: the revert is a new commit that takes the normal
route. A manual rollback outside the pipeline exists only as a break-glass last resort.

The priority is restoring service. Root cause can wait.

## Choose a response

| Situation | Response |
| --- | --- |
| The change has not reached production yet | [Halt the promotion](#halt-a-promotion), then fix forward |
| The fault is understood and the fix is small | Fix forward |
| The fault started with a known deploy and the version before it was healthy | Revert that change, as a fix forward |
| The fault is understood but the fix is large, risky or touches infrastructure | Mitigate first, for example with a feature flag or configuration change, then fix forward once the fix is reviewed |
| The cause is unknown and the impact is severe | Mitigate to stop the impact, then investigate. Do not deploy code you do not understand |
| The fault is in data, not code | Neither. A deploy will not repair data. Escalate to the data owner |
| Production is broken, no fix can be prepared in time, and the pipeline cannot be used | [Break-glass rollback](#break-glass-rollback) |

A fix forward is the right call when all of these hold:

1. You can say in one sentence what is broken and why the change fixes it.
2. The change is small enough to review in minutes.
3. You can check the result quickly in each affected environment.

If any of them does not hold, mitigate first. Agree the response with the incident lead before you
prepare anything, and record it in the incident channel.

## Assess the incident

1. **Blast radius.** Which domains, routes and environments are affected? A fault in development as
   well as production points to code. A fault only in production points to configuration, data or
   load.
2. **Timeline.** When did it start? Compare it with the last deploy to that environment. The
   "Flex deployed" messages in Slack give the version and time of each staging and production
   deploy. See [Releases](/flex/delivery/releases/#deployment-notifications).
3. **Suspect version.** Compare the version in production with the last healthy one, using the
   [GitHub releases](https://github.com/govuk-once/flex/releases) and the deployment messages.
4. **Alarms.** Note which alarms fired, and whether they are still firing. See
   [Alarms](/flex/observability/alarms/).

## Halt a promotion

Stop a change before it reaches the next environment.

- **At an approval gate:** select **Reject**, or leave the run waiting. Nothing reaches staging or
  production without an [approval](/flex/delivery/pipeline/#approvals). Reject older runs that are
  still waiting too, so nobody approves them later.
- **While a job runs:** select **Cancel workflow** on the run page, or run
  `gh run cancel <run-id>`. This stops the stages that have not started.

Cancelling undoes nothing. Stacks that already deployed stay deployed, and a CloudFormation update
that has started carries on without the runner. Check the stacks' status afterwards. See
[Validate the fix](#validate-the-fix).

Module E2E failures never halt the pipeline by themselves. If one points at a real regression, halt
the promotion by hand.

## What a failed deploy does by itself

If a deploy fails part way, CloudFormation rolls that stack back to its previous template and the
deploy job fails, so the next environment is not promoted. The deploy runs `cdk deploy --all` four
stacks at a time, so some stacks in the environment may have updated while the failing one rolled
back. Check each stack rather than assuming the whole environment reverted.

A change that deployed cleanly but behaves wrongly is not rolled back. CloudFormation considers
those stacks healthy. Fix forward.

## Prepare the fix

Keep the change as small as the incident allows.

- Change only what resolves or mitigates the incident. No refactors, tidy-ups or dependency bumps.
- Prefer a change to one domain over a platform-wide one.
- Avoid infrastructure changes unless the fault is in the infrastructure. Lambda code changes
  deploy faster and are easier to reverse than VPC, API Gateway or core stack changes.
- Make the fix itself easy to revert.
- Title the pull request as a fix, so it gets a patch release:

  ```text
  FLEX-<ref> fix(<scope>): <what the fix does>
  ```

  Title a revert as a `fix` too. A `revert` title deploys but produces no new version. See
  [Releases](/flex/delivery/releases/#versions).

Review is shortened, not skipped. Have a second engineer look at the diff before it merges, even
briefly on a call. Record who reviewed and who approved in the incident channel. If the incident
lead authorises an expedited change, record that before you deploy.

## Deploy the fix

Start with the first path. Move down only when the situation demands it, and say why each check you
skip is worth skipping.

### Through the pipeline

The default. Quality checks, versioning, E2E tests and approvals all stay in place.

1. Raise the fix as a pull request against `main`, and get it reviewed.
2. Merge it. Continuous Deployment runs quality checks, releases, then deploys to development.
3. Approve staging, then production, as each gate is reached. Stay with the run: it waits for you
   at each gate.
4. Check the E2E results at each stage before you approve the next. See
   [What to check before approving](/flex/delivery/pipeline/#what-to-check-before-approving).

### Re-run or run by hand

If the fix is already on `main` and a run failed for a transient reason, use **Re-run failed jobs**.
To redeploy the current `main` without a new merge, start Continuous Deployment by hand on `main`.
The same checks and gates apply. See
[Re-running and manual runs](/flex/delivery/pipeline/#re-running-and-manual-runs).

### Direct deploy

Only for a severe production incident, when the pipeline is unavailable or too slow, and only with
the incident lead's authorisation. It skips quality checks, versioning, E2E tests and approvals.

From a trusted machine with production credentials (see
[AWS credentials](/flex/start/environment-setup/#aws-credentials)), on the commit you mean to ship,
deploy only the affected domain:

```bash
domain=<name> STAGE=production pnpm run deploy
```

For a Lambda code change where every second counts, a [hotswap](/flex/delivery/environments/#hotswap)
replaces the function code without CloudFormation:

```bash
pnpm openapi:generate
domain=<name> STAGE=production pnpm --filter @platform/flex run hotswap production-<name>
```

Never hotswap an infrastructure change. CDK skips what it cannot hotswap, so the stack would be out
of step with its template.

Compared with a pipeline deploy:

| | Pipeline | Direct deploy |
| --- | --- | --- |
| Version | Tagged by semantic-release | None. Production runs code no release describes |
| Approval | Environment gate | None. Arrange the second pair of eyes yourself |
| E2E tests | Development and staging | None. Validate by hand |
| Slack | "Flex deployed" message | None. Announce it in the incident channel |

## Break-glass rollback

If production is broken, no fix can be prepared quickly, and the pipeline cannot help, a previous
release can be deployed by hand. This bypasses every gate. Use it only under incident conditions,
with the incident lead's authorisation.

```bash
git checkout v<previous-version>
pnpm install --frozen-lockfile
STAGE=production pnpm run deploy
```

This deploys every production stack, including the core stack, as it was at that tag. It does not
undo data or schema changes made since. Announce it in the incident channel and the release
channel. Then follow up with a fix forward through `main` straight away, because the next pipeline
run deploys `main` over the rollback.

## Validate the fix

A deploy that completes is not a fix that works.

1. **Check the stacks.** List the status of every stack in the environment:

   ```bash
   aws cloudformation describe-stacks \
     --query "Stacks[?starts_with(StackName, 'production-')].[StackName,StackStatus]" \
     --output table
   aws cloudformation describe-stacks --region us-east-1 \
     --stack-name production-FlexGlobal --query 'Stacks[0].StackStatus'
   ```

   `CREATE_COMPLETE` and `UPDATE_COMPLETE` mean the change applied. `UPDATE_ROLLBACK_COMPLETE`
   means it was rolled back, so the fix is not live: treat it as a failed deploy. A stack left in a
   `_FAILED` or `_IN_PROGRESS` state needs someone to resolve it in the CloudFormation console.
2. **Reproduce the symptom.** Send the request that was failing and confirm it now works.
3. **Check downstream.** A fix in one domain can move a problem rather than remove it. Check the
   domains and gateways the change touches, not only the one you edited. See
   [Verify environment health](/flex/runbooks/verify-environment-health/).
4. **Check every environment.** After a pipeline deploy, development and staging should be healthy
   too. After a direct deploy, land the same change through `main` and check there.
5. **Check the alarms.** The alarms that fired should return to `OK`. One still in `ALARM` means
   the incident is not over.

If validation fails, do not stack a second guess on the first. Go back to
[assessing](#assess-the-incident), mitigate to stop the impact, and prepare a corrected fix.

Keep watching the alarms and dashboards for a settling period agreed with the incident lead. Treat
anything under about 30 minutes of clean signal as provisional. A side effect that appears is a new
symptom of the same incident: reassess, and prefer a mitigation to another hurried change.

## Afterwards

1. **Reconcile.** If you deployed directly, hotswapped or rolled back, land the same change through
   `main`, so the pipeline, the tagged release and the running code agree. The incident is not
   closed until this is done.
2. **Say what is running.** State the version now in production in the incident channel.
3. **Raise the follow-up work:** the root cause investigation, and any remediation the fix deferred.
4. **Review.** Hold the post-incident review. Ask whether an alarm, test or pipeline check would
   have caught this sooner, and raise the work to add it. Improve this runbook with anything you had
   to work out under pressure.
