---
title: External service outage
description: Confirm a dependency behind a service gateway is failing, protect the journeys that use it, and escalate to its owner.
---

Use this runbook when a dependency that Flex reaches through a service gateway is down, slow or has
changed, and Flex journeys are failing because of it. Do the
[before you start](/flex/runbooks/overview/#before-you-start) steps first.

An outage in a dependency is not a Flex defect. The aim is to prove where the fault is, protect the
journeys around it, and get the owner working on their part. Flex cannot fix DVLA. It can stop DVLA
taking other journeys down with it.

## The dependencies

Each dependency has its own service gateway, defined in
`platform/domains/<name>/gateway.config.ts`. See [Service gateway catalogue](/flex/gateways/catalogue/)
for their routes and clients.

| Gateway | Upstream | How Flex reaches it | Who fixes it |
|---|---|---|---|
| `dvla` | DVLA APIs, a third party outside the programme | HTTPS with an API key and a token from DVLA's own authentication, via NAT | DVLA. Flex can only mitigate and relay their status. |
| `udp` | User Data Platform, a sibling GOV.UK service | SigV4 with a cross-account role | The UDP team, who can fix forward on their side |
| `uns` | The in-app notifications service, a sibling GOV.UK service | SigV4 with a cross-account role | The UNS team, who can fix forward on their side |
| `travel` | DynamoDB tables in another account (development and staging only) | Cross-account role, via NAT | The owner of the tables |

For UDP and UNS, contact the owning team early: they can often deploy the fix. For DVLA, escalation
means raising it through DVLA's support route.

## Steps

1. **Confirm the alarms point downstream.** The alarms most associated with a dependency problem
   are, in the order they usually fire:

   | Alarm | What it suggests |
   |---|---|
   | `integration-p95-latency` (API Gateway) | The backend is slow while API Gateway is fine. The strongest single signal. |
   | `duration` (Lambda) | Calls are running long, close to the timeout. |
   | `error-rate` (Lambda), `5xx-error-rate` (API Gateway) | Calls are failing. |

   The thresholds are in [Alarms](/flex/observability/alarms/). If the integration latency is high
   and API Gateway's own overhead is flat, the delay is downstream of Flex.

2. **Rule out a deployment.** If nothing was deployed shortly before the problem started, an
   external cause is more likely than a Flex regression. See
   [Correlating with deployments](/flex/runbooks/overview/#correlating-with-deployments).

3. **Map the failing journey to its gateway.** The domain's `domain.config.ts` lists the
   integrations each route uses. A `gateway` integration's `target` names the service gateway.

4. **Check it is one dependency, not the platform.** If only journeys that use one gateway fail,
   the fault is that dependency. If every journey fails whatever it calls, treat it as a platform
   problem and use [Verify environment health](/flex/runbooks/verify-environment-health/).

5. **Read the gateway's logs.** Open the service gateway function's log group (see
   [Logs](/flex/runbooks/overview/#logs)) and the calling domain's log group, and search for:

   ```text
   fields @timestamp, level, message, url, error
   | filter message like /flex-fetch|validation failed|upstream/
   | sort @timestamp desc
   | limit 100
   ```

   `url` and `error` show which upstream call failed and how. `flex-fetch` retries a call that
   could not complete, such as a network error or timeout. It does not retry an HTTP error
   response, which it returns to the caller.

6. **Check the upstream's own status.** Ask the UDP or UNS team, or check DVLA's published status.
   An acknowledged incident on their side confirms the diagnosis.

7. **Reproduce in another stage.** Run the domain's E2E tests against a lower stage. See
   [Reproducing with the E2E suites](/flex/runbooks/overview/#reproducing-with-the-e2e-suites). A
   fault in every stage is the shared dependency. A fault in one stage is that stage's
   configuration or credentials.

## Failure patterns

| Pattern | How it presents | Meaning | Response |
|---|---|---|---|
| Down or unreachable | `flex-fetch retrying request` then `flex-fetch failed`, high integration latency, Lambda errors | The upstream is not answering | Mitigate and escalate to the owner. |
| Erroring | 502 `<NAME> upstream service unavailable` from the gateway, `5xx-error-rate` alarm | The upstream answers with 5xx | Mitigate and escalate to the owner. |
| Slow | `duration` and latency alarms before any errors, 504s on routes with 30 second timeouts | The upstream is slow, not down | Mitigate. Escalate if it persists. |
| Client errors | Forwarded 4xx, such as a 404 for a licence that does not exist, `4xx-error-rate` alarm | Often expected | Confirm it is not a real fault before escalating. |
| Contract change | 502 `<NAME> upstream response invalid`, `Gateway response schema validation failed` in the gateway's logs | The upstream changed its response shape | A Flex-side schema fix. [Fix forward](/flex/runbooks/fix-forward/). Tell the owner. |
| Authorisation failure | Consistent 403 from UDP or UNS | A cross-account role or trust policy fault on the Flex side | A Flex-side fix, not an escalation. |

## Mitigate

Choose the smallest action that protects the journey. Any code or configuration change follows
[Fix forward](/flex/runbooks/fix-forward/).

- **Turn the feature off.** If the journey sits behind a feature flag, turn the flag off for the
  environment in the domain's configuration and deploy it. In a severe incident you can flip a flag
  at once by setting the Lambda environment variable with the flag's name to `false`, which takes
  precedence over the configuration:

  ```bash
  aws lambda get-function-configuration --function-name "<function name>" \
    --query "{Variables: Environment.Variables}" --region eu-west-2 > env.json
  # edit env.json: add "<flagName>": "false" under Variables, keep every other variable
  aws lambda update-function-configuration --function-name "<function name>" \
    --environment file://env.json --region eu-west-2
  ```

  This needs a role with write access. `--environment` replaces every variable, so keep the
  existing ones, and delete `env.json` afterwards. The next deployment overwrites
  this change, so make the same change in `main` straight away. See
  [Domain configuration](/flex/domains/configuration/) for feature flags.
- **Return a degraded response.** Where the journey can tolerate it, change the handler to return a
  fallback when the integration fails. This is a code change, shipped as a fix forward.
- **Leave retries alone.** More retries against a failing upstream add load and latency without
  helping. Change an integration's `retryAttempts` or `maxRetryDelay` only as a considered fix. See
  [Integrations](/flex/domains/integrations/).

## Escalate

Escalate to the owner when you have confirmed the fault is theirs (their 5xx, their timeouts, their
own incident) and a Flex-side mitigation cannot restore the journey, or when only they can resolve
it. Do not escalate a contract change or a 403 outward: those are Flex-side fixes. Say which
dependency is failing, since when, and what you have mitigated. See
[Escalating](/flex/runbooks/overview/#escalating).

## After recovery

Bring any flag flipped by hand back into `main`. If Flex absorbed the outage badly, with no fallback,
retries that made it worse, or an alarm that fired late, raise tickets for it. Then follow
[After recovery](/flex/runbooks/overview/#after-recovery).
