# API Gateway 5xx Runbook

How to investigate and respond to API Gateway 5xx errors on the AWS FLEX platform.

This runbook is for the on-call engineer. A 5xx means a request reached API Gateway but the platform failed to return a successful response. The fault is almost always behind the gateway, in a Lambda or an integration, so the work is to read the right code, trace the request to where it broke, and fix or escalate. You do not need prior incident experience to follow it. Work through the steps in order.

> A 5xx is API Gateway reporting that something behind it failed, not that API Gateway itself is broken. The status code is the first clue to where: interpret it before you go digging.

---

## Where a 5xx Comes From in FLEX

A request runs through `API Gateway → Lambda handler → (optional) integration → downstream service`. A 5xx is served either by API Gateway itself (the Lambda never returned a usable response) or by the FLEX handler (it returned a 5xx body on purpose). Reading the code tells you which.

| Status | Served by | Meaning in FLEX |
| ------ | --------- | --------------- |
| **500** | The FLEX handler | An unhandled or unexpected error, logged as `Internal server error` or `Unhandled error`; also returned when a handler's response fails its own schema (`Failed handler response validation`) |
| **502** | The FLEX handler, via the gateway helper | A downstream integration returned a 5xx; FLEX maps it to `"<integration> upstream service unavailable"`. Also served by API Gateway itself if the Lambda crashed, ran out of memory, or returned a malformed payload |
| **503** | API Gateway | The function was throttled or there was no capacity to serve the request |
| **504** | API Gateway | The integration exceeded its timeout; the Lambda ran past the timeout (30s by default) before responding |

The important split: **500 and a mapped 502 come from FLEX code and are logged with a clear message; a native 502, 503 or 504 comes from API Gateway and will not have a matching FLEX log line for that request** because the Lambda never returned cleanly. Which of the two you are looking at decides where you investigate.

---

## Step 1: Identify and Interpret the Error

Establish the scale and the shape of the failure before tracing individual requests.

1. **Read the alarm.** API Gateway alarms route by severity to SNS and into Slack via Amazon Q. The relevant ones are:

   | Alarm | Threshold | Tells you |
   | ----- | --------- | --------- |
   | API Gateway 5XX rate | > 1% over 5 min (critical) | Requests are failing outright, and roughly how many |
   | API Gateway integration p95 latency | backend latency high | The backend is slow, which precedes 504s |
   | API Gateway p95 latency | > 3000ms (warning) | End-to-end slowness; compare with integration latency to locate it |
   | Lambda error rate | > 1% (critical) | The handler is throwing, consistent with 500s and 502s |
   | Lambda p99 duration | > 80% of timeout (warning) | Requests approaching the timeout, consistent with imminent 504s |

2. **Find the exact status code.** The 5XX alarm does not distinguish 500 from 504. Query the API access logs (a dedicated JSON CloudWatch log group per stage, with `status`, `requestId`, method, resource path and latency) to see the actual codes and which routes are affected:

   ```text
   fields @timestamp, status, httpMethod, resourcePath, requestId
   | filter status >= 500
   | sort @timestamp desc
   ```

3. **Interpret the spread.** All 504s on one route points at a slow or hanging integration. A mix of 500s across many routes points at a shared fault (a resource, config, or the platform). A burst of 502s naming one integration points at a downstream outage (see the [External Service Outage Runbook](/docs/runbooks/external-service-outage-runbook.md)).

---

## Step 2: Trace the Request to Downstream

Pick a representative failing request and follow it from the edge to where it broke.

1. **Take the `requestId`** (and the `x-correlation-id`, if the caller sent one) from an access log entry for a failed request. FLEX threads the correlation id through its structured logs via Middy, so it links the edge log to the handler logs for the same request.
2. **Pivot into the Lambda log group** for the route's domain and filter for that correlation id or the time window. If you find a FLEX error line (`Internal server error`, `Unhandled error`, `upstream service unavailable`), the Lambda ran and the fault is in the handler or its integration. If you find nothing for that request, the Lambda did not return cleanly, which points at a native API Gateway 502, 503 or 504 (crash, throttle or timeout).
3. **Use X-Ray.** Active tracing is enabled on the API. The service map and individual traces show how far a request travelled and which segment errored or timed out, which is the quickest way to separate "the Lambda is slow" from "the thing the Lambda called is slow".

---

## Step 3: Investigate Using Logs and Metrics

Confirm the cause with the specific evidence.

**Logs (CloudWatch Logs Insights over the domain's Lambda log group).** These messages map directly to the causes:

| Search term | Meaning |
| ----------- | ------- |
| `Unhandled error` | An exception Middy caught and turned into a 500; the `detail` field carries the name, message and stack |
| `Internal server error` | An unexpected error mapped to a 500 |
| `Failed handler response validation` | The handler produced data that did not match its response schema, returned as a 500; a code or contract bug, not an outage |
| `upstream service unavailable` | A downstream integration returned a 5xx and FLEX mapped it to a 502; the message names the integration |
| `flex-fetch failed` | Calls to a downstream exhausted their retries; correlate the `url` to the target service |

**Metrics.** Plot `5XXError` against `IntegrationLatency` and `Latency` over the incident window. If integration latency climbs while API Gateway's own overhead stays flat, the delay is in the backend. Check Lambda `Errors`, `Duration` and `Throttles` for the affected function: throttles alongside 5xx point at a concurrency limit rather than a code fault.

**Access logs.** The access log gives the definitive status per request and the route, which is what the CloudWatch 5XX metric aggregates. Use it to quantify impact and confirm which routes recovered after a mitigation.

---

## Common Causes

Match the evidence to a cause, because the cause decides the fix.

| Cause | How it presents | Where it sits |
| ----- | --------------- | ------------- |
| **Integration timeout** | 504s; Lambda duration near the timeout; integration latency alarm | A downstream service is slow or hanging |
| **Downstream service failure** | 502s with `upstream service unavailable`; `flex-fetch failed` | The dependency is erroring; see the External Service Outage Runbook |
| **Unhandled exception** | 500s with `Unhandled error` and a stack; often follows a recent deploy | A bug in the handler |
| **Response validation failure** | 500s with `Failed handler response validation` | The handler or a downstream contract changed shape |
| **Throttling / concurrency** | 503s or 5xx with Lambda `Throttles` above zero | Reserved or account concurrency exhausted, or a downstream throttling FLEX |
| **Misconfiguration** | 500s or 502s starting exactly at a deploy, across routes | A missing or wrong resource (SSM parameter, secret, role, env var) |

---

## Step 4: Resolve, Mitigate and Escalate

Choose the smallest action that restores service. Anything shipped as code follows the [Fix Forward Runbook](/docs/runbooks/fix-forward-runbook.md).

**If it followed a deploy** (unhandled exceptions or misconfiguration starting at a known release), the fastest safe route is usually to revert the offending change forward, or to correct the missing configuration. Line the 5xx start time up against the deployment notifications in `#govuk-once-flex-release` to confirm.

**If a downstream service is failing or timing out** (502s, 504s, `upstream service unavailable`), this is a dependency incident: apply the mitigations in the [External Service Outage Runbook](/docs/runbooks/external-service-outage-runbook.md) (retries, fallbacks, feature toggles) and escalate to the dependency owner. Do not keep retrying harder against a service that is down; it adds load and latency without helping.

**If it is throttling** (503s, Lambda throttles), the fix is capacity, not code: review the function's concurrency and whether a downstream is rate-limiting FLEX. Escalate to raise a limit if the ceiling is the cause.

**When to escalate.** Escalate when the fault is outside FLEX's control (a failing dependency, a hit account or concurrency limit) and when impact is severe or prolonged and you cannot restore the journey with a FLEX-side change. A `500` from FLEX's own code (`Unhandled error`, `Failed handler response validation`) is a fix forward, not an escalation.

Communicate throughout as set out in the Fix Forward Runbook: state the status code and route affected, the cause you have confirmed, the mitigation applied, and confirm in the incident channel when the 5xx rate returns to baseline.

---

## After Recovery

1. **Reconcile any out-of-band changes** so the deployed state matches what is running.
2. **Confirm the 5XX alarm has cleared** and the rate has held at baseline for the agreed settling period before closing the incident.
3. **Raise follow-up work** for anything the incident exposed: a missing fallback, an alarm that fired late, a handler that should have caught its own error, or a timeout that needs tuning.
4. **Feed anything you worked out under pressure back into this runbook.**

---

## Related

**Guides:**

- [Fix Forward Runbook](/docs/runbooks/fix-forward-runbook.md)
- [External Service Outage Runbook](/docs/runbooks/external-service-outage-runbook.md)
- [Deployment Guide](/docs/deployment.md)
- [Log Redaction](/docs/log-redaction.md)

**Code:**

- Alarm definitions: [`platform/infra/flex/src/constructs/alarms`](/platform/infra/flex/src/constructs/alarms)
- [@flex/service-gateway](/libs/service-gateway/README.md)
