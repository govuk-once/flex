# External Service Outage Runbook

How to respond when an external service gateway dependency (DVLA, UNS, UDP) is failing or degraded and disrupting FLEX user journeys.

This runbook is for the on-call engineer. It assumes a live incident where a downstream dependency is suspected. Work through it in order: confirm there is an outage, isolate which dependency, investigate the evidence, recognise the failure pattern, then mitigate or escalate. You do not need prior incident experience to follow it.

> An external outage is not the same as a FLEX defect. The goal here is to prove where the fault lives, protect the user journey around it, and get the right team working on the part they own. FLEX cannot fix DVLA; it can stop DVLA taking the platform down with it.

---

## The External Dependencies

FLEX calls three external services. They fail differently and escalate to different owners, so identifying which one is involved is the first useful thing you can do.

| Dependency | What it provides | Ownership | Auth to reach it | Escalation route |
| ---------- | ---------------- | --------- | ---------------- | ---------------- |
| **DVLA** | Driver and licence data | Third party, outside the programme | Public / signed | DVLA service support; FLEX cannot fix, only mitigate |
| **UNS** | Notification delivery (GOV.UK) | Separate GOV.UK service | Public / signed | UNS / GOV.UK Notify team |
| **UDP** | User data platform | Sibling internal platform | SigV4, cross-account role | UDP on-call / team directly; they can fix forward on their side |

The practical difference: for **UDP** you can usually reach the owning team and they can deploy a fix; for **DVLA** and **UNS** you are largely limited to mitigating on the FLEX side and relaying the provider's status.

---

## How FLEX Calls Them

Understanding the call path tells you where each failure surfaces. A domain does not call an external service directly; it declares a named **integration** (`type: "gateway", target: "uns", route: "GET /v1/notifications"`) and the platform routes the call through:

```text
domain handler → service-gateway (REST client) → flexFetch → typedFetch → ApiResult
```

Two things about this chain drive everything below:

1. **`flexFetch` retries transient failures** with exponential backoff and jitter (delays between 10ms and 1000ms). Gateway calls default to 3 attempts; integrations can set their own `retryAttempts` and `maxRetryDelay`. When the retries are exhausted the call throws, which surfaces as a Lambda error and inflates its duration.
2. **`typedFetch` classifies the outcome** into an `ApiResult`. An upstream non-2xx becomes `{ ok: false, error: { status, message } }` with the upstream status preserved and forwarded. A response that does not match the expected schema becomes a `422 "Response validation failed"`, which usually means the provider changed its contract rather than went down.

So a hard outage shows up as Lambda errors and raised latency; a partial or contract fault shows up as forwarded error statuses or validation failures. Keep that distinction in mind.

---

## Step 1: Identify and Confirm an Outage

Do not assume; confirm. Establish that there is a real, current, dependency-related fault before acting.

1. **Read the alarm that brought you here.** FLEX alarms are routed by severity to two SNS topics and relayed into Slack by Amazon Q. The alarm name and description tell you the service and the threshold breached. The alarms most associated with a downstream outage are:

   | Alarm | Threshold | What it points at |
   | ----- | --------- | ----------------- |
   | API Gateway integration p95 latency | backend-only latency high | **The backend is slow** while API Gateway itself is fine; strongest signal of a slow dependency |
   | Lambda error rate | > 1% over 5 min (critical) | Calls are throwing, consistent with exhausted retries against a failing dependency |
   | Lambda p99 duration | > 80% of the function timeout (warning) | Requests are running long, consistent with a dependency timing out |
   | API Gateway p95 latency | > 3000ms (warning) | End-to-end slowness; compare against integration latency to locate the cause |
   | API Gateway 5XX rate | > 1% (critical) | Requests failing outright |

2. **Distinguish "our side" from "their side".** The integration p95 latency alarm exists precisely to separate API Gateway overhead from backend slowness. If integration latency is high while API Gateway's own overhead is normal, the delay is downstream of FLEX, which points at a dependency rather than the platform.

3. **Confirm it is current and not a deploy.** Check the deployment notifications in `#govuk-once-flex-release`. If nothing shipped recently, a fresh spike of errors or latency is more likely an external event than a FLEX regression.

4. **Check the provider's own status** where one is published (particularly DVLA and UNS). An acknowledged provider incident confirms the diagnosis immediately.

---

## Step 2: Isolate the Impacted Dependency

Narrow the fault to one dependency so you escalate to the right owner and mitigate the right journey.

1. **Map the failing journey to its integration.** The affected endpoint's domain config lists the integrations it uses and their `target`. The `target` (`dvla`, `uns`, `udp`) is the dependency in question.
2. **Confirm the pattern is dependency-specific, not platform-wide.** If only journeys that call one target are failing and everything else is healthy, the fault is that dependency. If every journey is failing regardless of target, suspect the platform (VPC, gateway auth, core stack) instead and treat it as a platform incident.
3. **Check the auth type for the target.** UDP is reached with a cross-account SigV4 role. A wave of `403`s from UDP can be a role or trust-policy problem, not a UDP outage; that is a FLEX-side fix, not an escalation to UDP.

---

## Step 3: Investigate Using Logs, Metrics and Health Checks

Gather the evidence that confirms the pattern and gives the owning team something to act on.

**Logs.** FLEX emits structured logs (with redaction) through `@flex/logging` to CloudWatch. In CloudWatch Logs Insights over the affected domain's log group, search for:

| Search term | Meaning |
| ----------- | ------- |
| `flex-fetch retrying request` | Transient failures are being retried; a rising volume is early warning of a struggling dependency |
| `flex-fetch failed` | Retries were exhausted and the call ultimately failed; correlate the `url` field to the target |
| `Response validation failed` | The provider responded but the body did not match the schema; suspect a contract change, not an outage |

The `url` and `error` fields on these entries confirm which dependency and which failure mode.

**Metrics.** Beyond the alarms, plot the target's error rate and the API Gateway integration latency over the incident window. A step change that starts at a specific time and holds is characteristic of an outage; a slow climb is characteristic of degradation.

**Health checks.** Exercise the failing journey directly against the affected stage to reproduce the symptom, and confirm the same request behaves in a lower stage. A fault that reproduces in every stage points at the shared external dependency; a fault only in one stage points at that stage's configuration.

---

## Common Failure Patterns

Match what you are seeing to one of these, because the pattern determines the mitigation.

| Pattern | How it presents | Likely meaning |
| ------- | --------------- | -------------- |
| **Timeouts / connection failures** | `flex-fetch retrying request` then `flex-fetch failed`; Lambda errors and raised p99 duration; integration latency high | Dependency is down or unreachable; retries are absorbing some load but exhausting |
| **5xx responses** | `ApiResult` `ok:false` with a 5xx status forwarded; API Gateway 5XX alarm | Dependency is up but erroring; usually a provider-side incident |
| **4xx responses** | Forwarded 4xx statuses (e.g. licence `404`); 4XX rate alarm (warning) | Often expected (not found) rather than an outage; confirm before escalating |
| **Degraded performance** | Latency and duration alarms fire before any hard errors | Dependency is slow, not down; retries and backoff are inflating FLEX latency |
| **Contract drift** | `Response validation failed` (422) | Provider changed its response shape; needs a FLEX-side schema fix, not escalation |
| **Auth failure** | Consistent `403` from one target (typically UDP) | Cross-account role or trust issue on the FLEX side, not a dependency outage |

---

## Step 4: Mitigate Impact and When to Escalate

Pick the smallest action that protects the user journey. Anything shipped as code follows the [Fix Forward Runbook](/docs/fix-forward-runbook.md).

**Retries.** Retry with backoff is already built into the gateway and cushions brief blips automatically. For a dependency that is slow rather than down, tuning an integration's `retryAttempts` or `maxRetryDelay` can help or hurt: more retries against a failing service add load and latency without helping. Treat retry tuning as a considered fix forward, not a reflex.

**Fallbacks.** Where a journey can tolerate it, having the handler return a degraded but usable response on an `ApiResult` `ok:false` (a cached value, a partial result, a graceful "try again later") keeps the wider journey alive while the dependency is down. This is a code change deployed as a fix forward.

**Feature toggles.** Feature flags are defined per environment in each domain's `domain.config.ts`, resolved in the order: `process.env` override, then environment membership, then default, then off. Turning a dependent feature off for production is normally a config change deployed through the pipeline. In a severe incident, the `process.env` override lets an operator flip a flag out of band by updating the Lambda's environment variable directly (`aws lambda update-function-configuration --environment`), which takes effect immediately. That change is overwritten by the next deploy and must be reconciled through `main` afterwards, exactly as the Fix Forward Runbook describes for any direct change.

**When to escalate.** Escalate to the dependency owner when any of the following hold:

1. You have confirmed the fault is in the external service (its 5xx, its timeouts, its published incident) and FLEX-side mitigation cannot restore the journey.
2. The impact is severe or prolonged and only the owner can resolve it.
3. The dependency is **UDP** and its team can fix forward on their side; contact them early, since that is often the fastest full resolution.

For **DVLA** and **UNS**, escalation means notifying the provider through the agreed support route and relaying their status to stakeholders; mitigation on the FLEX side continues in parallel. For a contract drift (`Response validation failed`) or an auth `403`, do not escalate outward: that is a FLEX-side fix forward.

Communicate throughout as set out in the Fix Forward Runbook: state which dependency is implicated, which mitigation you have applied, and confirm in the incident channel when the journey recovers.

---

## After Recovery

1. **Reconcile any out-of-band changes.** A flag flipped directly on a Lambda, or any manual mitigation, must be landed through `main` so the deployed state matches what is running.
2. **Raise follow-up work.** If the platform absorbed the outage poorly (no fallback, retries that made it worse, an alarm that fired late), raise tickets to improve resilience for next time.
3. **Feed back into this runbook.** If you had to work something out under pressure, add it here so the next engineer does not.

---

## Related

**Guides:**

- [Fix Forward Runbook](/docs/fix-forward-runbook.md)
- [Deployment Guide](/docs/deployment.md)
- [Log Redaction](/docs/log-redaction.md)
- [Release Notifications and Alerting](/docs/release-notifications.md)

**Code:**

- [@flex/service-gateway](/libs/service-gateway/README.md)
- Alarm definitions: [`platform/infra/flex/src/constructs/alarms`](/platform/infra/flex/src/constructs/alarms)
