---
title: Runbooks
description: Which runbook to use, and the access, communication, escalation and investigation steps every incident shares.
---

Runbooks are for whoever is responding to an alert or a report of a problem. They assume no
previous incident experience. Pick the runbook that matches what you are seeing, then follow its
steps in order.

| Runbook | Use it when |
|---|---|
| [Verify environment health](/flex/runbooks/verify-environment-health/) | You need to confirm an environment is healthy after a deployment, or find out what is wrong when you do not know where to start. |
| [Lambda errors or throttling](/flex/runbooks/lambda-errors-throttling/) | A Lambda `error-rate`, `throttles` or `duration` alarm has fired. |
| [API Gateway 5xx](/flex/runbooks/api-gateway-5xx/) | An API Gateway `5xx-error-rate` alarm has fired, or callers report 5xx responses. |
| [External service outage](/flex/runbooks/external-service-outage/) | A third party behind a service gateway (DVLA, UDP, UNS) looks down, slow or changed. |
| [Alarm relay failures](/flex/runbooks/alarm-relay-failures/) | A `flex-alarm-relay` alarm has fired, or edge alerts seem to be missing. |
| [Fix forward](/flex/runbooks/fix-forward/) | You know the fix and need to ship it, revert a change, or halt the pipeline. |
| [Leaked secret](/flex/runbooks/leaked-secret/) | A credential, key or token may have been exposed. |

What each alarm measures, its threshold and where it notifies are in
[Alarms](/flex/observability/alarms/). The runbooks do not repeat it.

## How alerts arrive

Alarms post to the alerting Slack channel for the environment through Amazon Q Developer in chat
applications. Critical and warning alerts share one channel per environment. Nothing pages anyone,
so someone has to be watching the channel. See [Alarms](/flex/observability/alarms/) for the
channels and how to read an alert.

Two alarms never reach Slack: the smoke test alarm, and the alarm relay health alarms. Check them by
hand when you verify an environment.

## Before you start

1. Get read-only credentials for the account of the environment you are investigating, with
   `gds-cli`. See [AWS credentials](/flex/start/environment-setup/#aws-credentials). Steps that
   change something, such as replaying an alert or rotating a secret, say so and need a role with
   write access.
2. Set the stage, so every command in the runbooks targets it:

   ```bash
   export STAGE=<development|staging|production|your stage>
   ```

3. Know the two regions. Almost everything is in `eu-west-2`. CloudFront, CloudFront Functions, the
   CloudFront web ACL, Shield, the alarm relay and the `<stage>-FlexGlobal` stack are in
   `us-east-1`.

The runbooks use `date -u -d '2 hours ago'` (GNU `date`, as on Linux). On macOS use
`date -u -v-2H` instead.

## Communicating during an incident

Follow the central incident process. It is the source of truth for roles, severities and
communication, and these runbooks add only what is specific to Flex:

- [GDS Way: how to manage technical incidents](https://gds-way.digital.cabinet-office.gov.uk/standards/incident-management.html#how-to-manage-technical-incidents)
- [GOF: Incident Process](https://gdsgovukagents.atlassian.net/wiki/spaces/GOF/pages/79495229/Incident+Process) (Confluence)

For anything user-facing, or anything in production:

1. Raise it in `#govuk-app-incident` and flag it in `#govuk-once-flex-dev`. Say what is affected,
   which stage, since when, and what you know so far.
2. Agree an incident lead and the severity.
3. Keep a running timeline in the incident thread: what you saw, what you changed and when, and what
   the result was.
4. Post when the impact ends and when the incident is closed.

Never post a secret value, a token or personal data in Slack, a ticket or a pull request. Refer to
secrets by name and location.

## Escalating

Escalate to the `govuk-once-flex-developers` team when:

- the fix needs access you do not have, such as admin access to recover a stack stuck in
  `UPDATE_ROLLBACK_FAILED` or to change account-level limits
- production is affected and the runbook has not got you to a cause or a mitigation quickly
- finding the cause is taking a long time while users are affected

When the fault is in a dependency Flex does not own, escalate to its owner. The
[External service outage](/flex/runbooks/external-service-outage/) runbook says who that is for each
service gateway.

## Shared investigation tools

### Correlating with deployments

Most incidents start at a deployment. Line the start of the problem up against the deployment
notifications in Slack and the run history of the pipeline. See
[Releases](/flex/delivery/releases/) for where notifications go and
[Pipeline](/flex/delivery/pipeline/) for reading a run.

### Logs

Every Flex Lambda has its own CloudWatch log group, encrypted and kept for a year. Find a
function's log group from the function, rather than guessing its name:

```bash
aws lambda get-function-configuration \
  --function-name "<function name>" \
  --query "LoggingConfig.LogGroup" \
  --output text \
  --region eu-west-2
```

Logs are structured JSON from `@flex/logging`, with secrets and personal data redacted. See
[Logging](/flex/observability/logging/). These messages come up in several runbooks:

| Message | Logged by | Meaning |
|---|---|---|
| `Unhandled error` | Domain handler (Middy error handler) | An unexpected error, returned to the caller as a 500. `detail` holds the name, message and stack. |
| `Response validation failed` | Domain handler | The handler's result did not match the route's `response` schema. Returned as a 500. A code or contract defect. |
| `flex-fetch retrying request` | Domain integration call | A call to an integration failed and is being retried. A rising count is an early warning. |
| `flex-fetch failed` | Domain integration call | A call failed after its last retry. `url` names the target. |
| `Gateway response schema validation failed` | Service gateway | The upstream answered, but the body did not match the route's `response` schema. Returned as a 502 `<NAME> upstream response invalid`. The upstream changed its contract. |
| `Internal server error` | Service gateway | An unexpected error in the gateway, returned as a 500. |

A service gateway turns an upstream 5xx into a 502 with the body
`<NAME> upstream service unavailable`, where `<NAME>` is the gateway name in capitals. It logs that
only at debug level, so search for the 502 in the access log or for `flex-fetch failed` in the
calling domain instead.

The code is in
[`libs/sdk/src/route`](https://github.com/govuk-once/flex/blob/main/libs/sdk/src/route),
[`libs/sdk/src/fetch/fetch.ts`](https://github.com/govuk-once/flex/blob/main/libs/sdk/src/fetch/fetch.ts)
and
[`libs/service-gateway/src`](https://github.com/govuk-once/flex/blob/main/libs/service-gateway/src).

### Traces

Every Flex Lambda and both APIs have X-Ray active tracing. In the CloudWatch console, open
**X-Ray traces** > **Trace map** to see each node's errors, faults and throttles, and open a trace
to see which downstream call took the time. This is the quickest way to tell a slow function from a
slow dependency.

### Reproducing with the E2E suites

The E2E suites run against a deployed stage with the credentials you already have:

```bash
# Platform tests (CloudFront, authentication, private API)
CI=1 STAGE=$STAGE pnpm --filter @flex/e2e test:e2e:platform

# One domain's tests, such as @flex/udp-domain or @flex/dvla-domain
CI=1 STAGE=$STAGE pnpm --filter @flex/<domain>-domain test:e2e
```

Domain tests write data, so think before running them against production. Make sure
`tests/e2e/.env` has nothing that points at a different stage. See
[E2E tests](/flex/delivery/e2e-tests/).

A fault that reproduces in every stage points at a shared dependency. A fault in one stage points at
that stage's configuration or data.

## Shipping a fix

Follow [Fix forward](/flex/runbooks/fix-forward/) to choose between a fix, a revert and a runtime
mitigation, and to ship it, including when a direct deployment is allowed. See
[Pipeline](/flex/delivery/pipeline/) for promoting a change and
[Environments](/flex/delivery/environments/) for deploying by hand.

## After recovery

1. Confirm the alarms that fired are back in `OK` and have stayed there.
2. Bring anything changed by hand during the incident back into `main`, so the next deployment does
   not undo the fix or bring the fault back.
3. Raise tickets for what the incident exposed: a missing alarm, a missing fallback, a timeout to
   tune, a control that should have caught it.
4. Update the runbook you used with anything you had to work out under pressure.
