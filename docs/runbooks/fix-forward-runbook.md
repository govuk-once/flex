# Fix Forward Runbook

How to execute a fix forward during an incident on the AWS FLEX platform.

This runbook is for the on-call engineer. It assumes you are responding to a live incident and need to decide, prepare, deploy and validate a corrective change under time pressure. You do not need prior incident experience to follow it. Read the decision section first, then work through the numbered steps for the path you choose.

> During an incident the priority is restoring service, not explaining it. A fix forward is often the fastest safe route back to a healthy state. Root cause can wait; a stable service cannot.

---

## What a Fix Forward Is

A fix forward is a new, forward change deployed through the normal pipeline to mitigate or resolve a live incident. Instead of reverting the platform to an earlier state, you move it to a corrected later state. In practice this is a small, targeted commit merged to `main` (or, in the most urgent cases, a direct deploy to the affected stage) that fixes the fault or removes its impact.

It is distinct from a rollback, which returns the platform to a previously released version, and from a runtime mitigation such as a feature flag, a configuration change or scaling, which changes behaviour without shipping code.

FLEX deploys forward only. There is no automated "undo" button; semantic-release tags every push to `main` and the pipeline always rolls forward. A rollback on FLEX is itself a fix forward: it is a revert commit that produces a new version. Understanding this is the key to the whole runbook. The question is rarely "forward or back", it is "what is the smallest forward change that restores service".

---

## When a Fix Forward Is Appropriate

Choose the strategy that restores service soonest with the least added risk. Use the table to decide, then confirm your choice with the incident lead before preparing anything.

| Situation | Preferred strategy | Why |
| --------- | ------------------ | --- |
| Fault is understood and the fix is small and well scoped | **Fix forward** | Fastest correct route; avoids discarding good changes shipped alongside the fault |
| Fault appeared immediately after a known deploy and the previous version was healthy | **Revert (a fix forward)** | Reverting the offending commit is a small, low risk forward change |
| Fault is understood but the fix is large, risky or touches infrastructure | **Runtime mitigation first, then fix forward** | Reduce impact now (flag, config, scale), ship the real fix once prepared and reviewed |
| Cause is unknown and impact is severe | **Mitigate to stop the bleeding, then investigate** | Do not deploy code you do not understand into a live incident |
| Fault is data related, not code related | **Neither; treat as a data incident** | A deploy will not fix corrupted or missing data; escalate to the data owner |

A fix forward is the right call when all of the following hold:

1. You understand what is broken and why the change fixes it.
2. The change is small enough to review and reason about in minutes, not hours.
3. You can validate the outcome quickly across the affected stages.
4. The alternative (rollback) would discard other legitimate changes, or no healthy earlier version exists.

If any of these do not hold, prefer a runtime mitigation to buy time, and only then prepare the fix.

---

## Assessing the Incident

Before touching code, establish the facts. Spend a few minutes here; it saves far more later.

1. **Confirm the blast radius.** Which domains, endpoints and stages are affected? Production only, or staging and development too? A fault present in development as well as production points to code; a fault only in production points to configuration, data or scale.
2. **Fix the timeline.** When did it start? Line it up against the most recent deployment. The deployment notifications in `#govuk-once-flex-release` ("Flex deployed: v1.2.0 to production") give you the version and time of the last change to each stage.
3. **Identify the suspected version.** Compare the current production version against the last known healthy one. The GitHub releases page and the deployment notifications together tell you what shipped and when.
4. **Check the alarms.** Review the CloudWatch alarms that fired and the SNS/Amazon Q messages they produced. Note which service emitted them and whether they are still active or have cleared.
5. **Decide the strategy** using the table above, and record the decision with the incident lead before proceeding.

> If you cannot explain in one sentence what is broken and why your change fixes it, you are not ready to deploy. Mitigate first.

---

## Preparing the Fix

Keep the change as small as the incident allows. Scope discipline is what makes a fix forward safe.

**Constraints during an incident:**

- Change only what is needed to resolve or mitigate the incident. Do not fold in unrelated tidy-ups, refactors or dependency bumps. Everything extra is untested risk shipped straight to production.
- Prefer a single domain change over a platform-wide one. Deploying one domain (`domain=<name>`) limits the blast radius of the fix itself.
- Avoid infrastructure changes unless the fault is infrastructural. Lambda code changes are far quicker and safer to deploy and reverse than VPC, API Gateway or core stack changes.
- Follow the commit convention so the release is versioned correctly. A `fix:` commit produces a patch release, which is what an incident fix should almost always be:

  ```txt
  FLEX-<ref> fix(<domain>): <what the fix does>
  ```

- Write the fix so it is itself safe to reverse. Small, self-contained commits revert cleanly if the fix does not land as intended.

**Approvals during an incident:**

The normal review gate still applies, but it is compressed, not skipped. Get a second engineer to review the diff before it merges, even if that review is a two-minute look over a shoulder or a screen share. The GitHub Environment protection on staging and production means someone must still approve the deploy to those stages, so a reviewer is in the loop by design. Record who reviewed and who approved in the incident channel.

If protocol allows an incident lead to authorise an expedited change, capture that authorisation in the incident timeline before you deploy, not after.

---

## Deploying the Fix

There are three deployment paths, ordered from safest to most urgent. Start at the top and only move down if the situation genuinely demands it. Every path down the list trades safety checks for speed, so justify each step you skip.

### Path 1: Through the standard pipeline (default)

This is the normal route and should be your first choice. It runs quality checks, versions the release and progresses through the stages with E2E tests and approval gates intact.

1. Raise the fix as a pull request against `main` with a `fix:` title.
2. Get the expedited review (see Preparing the Fix).
3. Merge. The Continuous Deployment pipeline ([`main.yml`](/.github/workflows/main.yml)) runs Quality Checks, then Release, then deploys to development, staging and production in sequence.
4. Approve the staging and production Environment gates as they are reached. Do not walk away; the pipeline waits for you at each gate.
5. Watch each stage's E2E tests pass before the next begins.

Use this path whenever the incident can tolerate the few extra minutes the full pipeline takes. It is slower than the paths below but keeps every safety net in place.

### Path 2: Manual pipeline dispatch

If a fix is already merged and you need to re-run deployment (for example the pipeline failed partway, or you need to redeploy the current `main`), trigger the pipeline manually. `main.yml` supports `workflow_dispatch`, so it can be started from the Actions tab without a new push. The same quality checks, E2E tests and approval gates apply.

### Path 3: Direct stage deploy (last resort)

Reserve this for a severe production incident where the pipeline itself is unavailable or too slow to be viable, and only with incident lead authorisation. It bypasses quality checks, versioning and the approval gates, so the safety burden moves entirely onto you and your reviewer.

Deploy a single domain to the affected stage from a trusted workstation with the correct AWS credentials:

```bash
domain=<name> STAGE=production pnpm deploy
```

For a Lambda code-only change where every second counts, a hotswap updates the function code directly without a full CloudFormation deployment:

```bash
domain=<name> STAGE=production pnpm --filter @platform/flex hotswap
```

> Hotswap is for code changes only. Never hotswap an infrastructure change; it will leave the deployed stack and CloudFormation out of step. Any hotswap or direct deploy must be reconciled straight afterwards by landing the same change through `main` so the pipeline and the tagged version reflect what is actually running.

**Differences from a standard deploy under incident conditions:**

- Versioning: direct deploys are not tagged by semantic-release, so production can be running code that no release describes. Reconcile through `main` as soon as the incident is stable.
- Approvals: the Environment gates that normally force a second pair of eyes are absent on a direct deploy, so arrange that review yourself.
- E2E tests: the pipeline's automated E2E run does not happen on a direct deploy, so you must validate manually (see below).
- Notifications: the "Flex deployed" Slack message is not sent for a direct deploy, so announce the change in the incident channel by hand.

---

## Validating the Fix

A deploy that completes is not a fix that works. Confirm the incident is actually resolved or mitigated before you stand down.

1. **Confirm the deploy landed.** Check the stack is updated and healthy:

   ```bash
   aws cloudformation describe-stacks \
     --stack-name production-FlexPlatform \
     --query 'Stacks[0].StackStatus'
   ```

   A healthy stack reports `UPDATE_COMPLETE`. If CloudFormation rolled the change back (`UPDATE_ROLLBACK_COMPLETE`), the fix did not apply; treat that as a failed deploy and reassess.

2. **Reproduce the original symptom.** Exercise the exact request, endpoint or flow that was failing and confirm it now behaves. If you have a reliable reproduction from the assessment step, re-run it.

3. **Check the affected services end to end.** A fix in one domain can move a problem rather than remove it. Verify the domains downstream of the change, not just the one you touched.

4. **Check across stages.** If the fix went through the pipeline, confirm development and staging are healthy as well as production; a fault that persists in a lower stage means the fix is incomplete. If you deployed directly to production, deploy the same change to the lower stages through `main` and confirm there too.

5. **Confirm the alarms have cleared.** The CloudWatch alarms that fired for the incident should return to `OK`. An alarm still in `ALARM` after the fix is a signal the incident is not over.

If validation fails, do not layer a second guess on top of the first. Return to the assessment step, consider a runtime mitigation to stop the impact, and prepare a corrected fix.

---

## Monitoring After the Fix

Stay engaged after the fix lands. Many incidents relapse or reveal side effects in the minutes that follow.

- Keep watching the CloudWatch alarms and dashboards for the affected services for a defined settling period (agree the duration with the incident lead; treat anything under about thirty minutes of clean signal as provisional).
- Watch for new alarms in services adjacent to the change. A fix that fixes one thing and breaks another shows up here first.
- Confirm error rates, latency and throughput return to their normal baselines rather than merely stopping the specific failure you targeted.
- Watch `#govuk-once-flex-release` for the deployment notification confirming the version that is now live, so the channel record matches reality.
- Do not close the incident on the first green signal. Close it when the signal has held clean for the agreed settling period and no side effects have appeared.

If a side effect appears, treat it as a new symptom of the same incident: reassess, and prefer a runtime mitigation over stacking another hurried code change on top.

---

## Communicating the Fix Forward

Clear communication is part of the fix, not an afterthought. Keep stakeholders informed at each step.

**During the incident:**

1. State the chosen strategy in the incident channel when you decide it ("proceeding with a fix forward, reverting the change from v1.2.0").
2. Record who reviewed and who approved the change.
3. Announce the deploy as it starts, and which path you are using (standard pipeline, manual dispatch or direct deploy).
4. If you used a direct deploy, post it explicitly, since the automated "Flex deployed" notification will not fire for it.
5. Confirm in the channel when validation passes and the alarms clear.

**After the incident:**

- Post a short summary: what broke, what the fix forward did, when service was restored and what is still outstanding (for example a direct deploy still to be reconciled through `main`).
- Notify the wider stakeholders on the agreed channel with an impact statement in plain terms: what users experienced, for how long, and that it is resolved.
- Make sure the version now running in production is stated plainly, so everyone is working from the same picture.

---

## Root Cause Analysis and Follow-Up

A fix forward stabilises the service; it does not usually explain the incident. Once the service is stable and the settling period has passed, move from response to remediation.

1. **Reconcile any shortcuts.** If you deployed directly to a stage or hotswapped, land the identical change through `main` so the pipeline, the tagged release and the running code all agree. Do this before you consider the incident closed.
2. **Raise the follow-up work.** Create tickets for the root cause investigation and for any longer-term remediation the fix forward deferred. A fix forward is frequently a patch over a deeper problem; name that problem in a ticket so it is not forgotten once the pressure is off.
3. **Run the post-incident review.** Capture the timeline, the decision to fix forward, what went well and what slowed you down. Feed anything you had to work out under pressure back into this runbook.
4. **Check for prevention.** Ask whether an alarm, a test or a pipeline gate would have caught this sooner, and raise the work to add it.

The goal is that the next engineer facing the same class of incident finds it already understood, already alarmed for, and this runbook a little sharper for what you learned.

---

## Related

**Guides:**

- [Deployment Guide](/docs/deployment.md)
- [Releases and Versioning](/docs/releases.md)
- [Release Notifications and Alerting](/docs/release-notifications.md)

**Workflows:**

- [`main.yml`](/.github/workflows/main.yml) (Continuous Deployment)
- [`_build-deploy.yml`](/.github/workflows/_build-deploy.yml) (Build and Deploy)
