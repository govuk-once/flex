# Critical alerts

What a critical alert means for FLEX, where alerts go, how to respond, and which conditions page. The thresholds come from the FLEX critical alerting strategy agreed with the UDP team, which shares the rule for what counts as critical across GOV.UK Connect services.

---

## The rule

An alert is **critical** only if it shows that the platform is unavailable, that a key user journey is materially degraded, that a key or secret FLEX depends on is at risk, or that an important SLO will be breached unless someone acts. A single infrastructure metric going over a threshold is not enough on its own.

Before an alert is wired to the critical topic it must answer yes to at least one of these:

1. Is the platform unavailable or effectively unavailable, for example because authentication is failing for most requests, or no traffic is reaching the edge?
2. Is a key journey materially degraded, meaning a sustained significant failure rate?
3. Is a key, secret or identity resource that the platform depends on at risk?
4. Will an availability SLO be breached unless someone acts, meaning a rapid error budget burn?

It must also be actionable: the alarm description names the condition in plain English and links to a runbook.

Everything else is a **warning**. Warnings are reviewed in working hours and are never an incident on their own. A single Lambda erroring, a single throttled invocation, a WAF managed rule blocking a request, or a slow function are all warnings unless they push a journey over one of the four tests.

---

## Severity and response

| Severity | Meaning | Notify | Acknowledge | Start mitigating |
| --- | --- | --- | --- | --- |
| Critical (P1) | Significant, sustained impact on a key journey; the platform unavailable; a key or secret at risk; alerting itself broken | Critical Slack channel | 15 min | 30 min, then declare an incident and tell the app team |
| Warning (P2) | Degradation, or a risk that becomes critical if left alone | Warnings Slack channel | Same working day | Within 1 working day |
| Info (P3) | Useful signal with no user impact | Dashboards | None | Backlog |

The acknowledge and mitigate times match the UDP service so that GOV.UK Connect responds to the two platforms in the same way. FLEX has no pager yet; a critical alert is a Slack message in the critical channel, so the channel must be one that the FLEX team watches. If a paging tool is adopted, subscribe it to the `flex-alerts-critical` topic alongside Slack.

When a critical alert arrives:

1. Open the runbook linked in the alert and work through it. The alert text starts with the condition (`SERVICE UNAVAILABLE`, `READS DEGRADED`, `AUTH FAILURE`, and so on) so the right runbook is usually obvious.
2. Check `#govuk-once-flex-release` for a recent deploy. A failure that starts at a release is a [fix forward](/docs/runbooks/fix-forward.md).
3. If the journey cannot be restored within 30 minutes, declare an incident and communicate to the consumer.
4. After recovery, raise follow up work for anything the alarm exposed, including an alarm that was late, noisy or missing.

---

## Where alerts go

Alarms publish to one of two SNS topics in `eu-west-2`, `flex-alerts-critical` and `flex-alerts-warning`, each wired to its own Slack channel through Amazon Q (AWS Chatbot). Edge alarms in `us-east-1` reach the same topics through the [alarm relay](/docs/runbooks/alarm-relay-failures.md).

| Topic | Chatbot configuration | Slack channel id parameter |
| --- | --- | --- |
| `flex-alerts-critical` | `flex-alerts-critical-<env>` | `/<env>/flex-param/monitoring/criticalSlackChannelId` |
| `flex-alerts-warning` | `flex-alerts-<env>` | `/<env>/flex-param/monitoring/slackChannelId` |
| `<stage>-flex-alerts-relay-health` (`us-east-1`) | `flex-alerts-critical-<stage>` | `/<env>/flex-param/monitoring/criticalSlackChannelId` |

The relay health topic bypasses the relay on purpose: if the relay is broken, its own alarms must still arrive, so they go straight to the critical channel. Amazon Q allows one configuration per Slack channel per AWS account, so the topic is added to the critical channel configuration owned by FlexCore rather than getting one of its own; FlexCore builds the topic ARN from its deterministic name. This subscription exists in development, staging and production only; personal and PR stages have the relay health alarms but no Slack route for them.

> The channel id parameters are provisioned by the [`flex-params`](https://github.com/govuk-once/flex-params) stack, like every other `/<env>/flex-param/*` value, and must be deployed before `FlexCore` or `FlexGlobal`. To move critical alerts to a dedicated channel, create it with the Platform team, add Amazon Q to it, and change `/monitoring/criticalSlackChannelId` for that environment in `flex-params`. Personal and PR stages reuse the development parameters.

---

## What raises a critical alert

Each condition maps to a test in the rule above. Burn rate alarms are composites of two windows, both of which must breach; see [How the burn rate thresholds are derived](#how-the-burn-rate-thresholds-are-derived).

| # | Condition | Alarm | Stack | Fires when |
| --- | --- | --- | --- | --- |
| C1 | Authentication failing for most requests | `<stage>-apigw-auth-failure`, `<stage>-smoke-test-auth-rejected` | `FlexPlatform`, `FlexSmokeTest` | 401 and 403 above 50% of public API requests over both 15 and 5 minutes with at least 20 requests, or the smoke test's valid token is refused 3 runs in a row |
| C2 | Reads degraded | `<stage>-journey-reads-fast-burn` | `FlexPlatform` | Failed requests above 7.2% of valid GET requests on the udp, topics and groups routes over both 1 hour and 5 minutes |
| C3 | Writes degraded | `<stage>-journey-writes-fast-burn` | `FlexPlatform` | Failed requests above 1.44% of valid POST, PATCH, PUT and DELETE requests on the same routes over both windows |
| C4 | Driving degraded | `<stage>-journey-driving-fast-burn` | `FlexPlatform` | Failed requests above 7.2% on the dvla routes over both windows. The alert names the DVLA gateway |
| C5 | Notifications degraded | `<stage>-journey-notifications-fast-burn` | `FlexPlatform` | Failed requests above 7.2% on the uns routes over both windows |
| C6 | Platform effectively unavailable | `<stage>-smoke-test-<journey>-no-success` | `FlexSmokeTest` | A probed journey fails or does not report 3 times in a row, one run per minute |
| C7 | Edge failing or traffic stopped | `<stage>-cloudfront-5xx-error-rate`, `<stage>-cloudfront-traffic-cliff` | `FlexGlobal` | CloudFront 5xx above 1% for 5 minutes, or requests below the learned baseline for 3 consecutive 5 minute periods (staging and production only) |
| C8 | Key, secret or identity resource at risk | `kms-key-change-alert`, `cognito-user-pool-change-alert`, `secret-rotation-alert`, `<stage>-dvla-secret-rotation-failed` | `FlexCore`, `FlexGlobal` | A KMS key is disabled, scheduled for deletion or has its policy changed outside a deployment; a user pool or client is deleted; a secret rotation fails |
| C9 | Under attack and mitigation not holding | `<stage>-*-waf-blocking-90-percent-requests-v2`, `<stage>-shield-ddos-detected` | `FlexPlatform`, `FlexGlobal` | WAF blocking more than 90% of requests in 5 minutes, or Shield Advanced detects a DDoS (staging and production) |
| C10 | Alerting itself broken | `<stage>-flex-alarm-relay-<severity>-*` | `FlexGlobal` | The relay fails to forward an edge alarm, or a forwarded notification lands in the failure queue |

Other critical alerts already in place and kept: certificate expiry (`<stage>-certificate-days-to-expiry`), Cognito configuration drift, and the IAM, Lambda and CloudFormation change alerts described in [IAM change alerts](/docs/iam-change-alerts.md).

### Journeys

A journey is a group of public API routes a consumer uses for one task. The mapping lives in `platform/infra/flex/src/constructs/alarms/journeys.ts`, keyed by journey name.

| Journey | Routes | SLO | Fast burn pages at |
| --- | --- | --- | --- |
| reads | `GET` on `/app/udp/v1/*`, `/app/topics/v1/*`, `/app/groups/v1/*` | 99.5% | 7.2% |
| writes | `POST`, `PATCH`, `PUT`, `DELETE` on the same paths | 99.9% | 1.44% |
| driving | `/app/dvla/v1/*` except `/test-notification` | 99.5% | 7.2% |
| notifications | `/app/uns/v1/*` | 99.5% | 7.2% |
| travel | `/app/travel/v1/*` | 99% | warning only |

A failed request is a `5xx` or a `429`. Other `4xx` responses are the caller's fault and are excluded from both the numerator and the denominator; `401` and `403` are measured by C1 instead.

### How the burn rate thresholds are derived

The method is the multi window burn rate alert from the Google SRE workbook, with the same figures as the UDP service.

1. The SLO is measured over a rolling 28 days. The error budget is what the SLO leaves over: 0.5% of requests for a 99.5% target, 0.1% for 99.9%.
2. A burn rate of 14.4x spends 2% of the month's budget in one hour, which is the conventional pace at which a human should be paged.
3. The threshold is budget multiplied by burn rate: `0.5% x 14.4 = 7.2%` for reads, `0.1% x 14.4 = 1.44%` for writes.
4. Both a 1 hour and a 5 minute window must breach. The hour proves the failure is sustained; the 5 minutes proves it is still happening.
5. Below 20 valid requests in the window the rate is forced to zero, so one failure in three requests does not page. The smoke test covers availability at low traffic.

The slow burn warnings use 6x over 6 hours and 30 minutes (3% for reads, 0.6% for writes).

---

## What stays as a warning

| Warning | In plain English |
| --- | --- |
| `<stage>-journey-*-slow-burn` | A journey is burning budget faster than its SLO allows, but not fast enough to page |
| `<stage>-journey-travel-fast-burn` | Travel alerts are informational content, so even a fast burn is a warning |
| `<stage>-apigw-*-5xx-error-rate` | The same failures the journey alarms measure, kept as a diagnostic |
| `<stage>-apigw-*-4xx-error-rate` | Callers sending bad requests, or one consumer with an auth problem |
| `<stage>-apigw-*-p95-latency` | FLEX is slow but requests are succeeding |
| `<stage>-<function>-alarm-error-rate`, `-throttles`, `-duration` | One function is in trouble; whether users are affected shows in the journey alarms |
| `<stage>-*-waf-managed-rules-blocked-requests-v2` | Known bad inputs are being blocked, which is the WAF working |
| `<stage>-*-waf-blocked-requests-spike-anomaly-v2` | Blocks above baseline; worth a look |
| `<stage>-shield-ddos-attack-requests-per-second` | Attack volume while mitigation is active |
| `<stage>-cff-*` | The viewer request functions; impact shows in the CloudFront 5xx rate |
| `<stage>-cloudfront-4xx-error-rate`, `-total-error-rate` | Edge client errors |
| `*-undelivered`, `*-lost` | An event alert could not be delivered |

### Cold starts

Cold starts used to trip the per function duration alarm at low traffic, because the p99 of a 5 minute window with a handful of invocations is just the slowest one, and the slowest one is usually the first. The duration alarm now forces the rate to zero below 10 invocations in the window and needs 2 of 3 windows to breach. The API Gateway latency alarms were already suppressed below 40 requests per 5 minutes. Lambda's `Duration` metric excludes initialisation time; the cold start cost that reaches users is visible in the API Gateway latency alarms and in `@initDuration` in the function logs.

---

## Not yet covered

- The smoke test probes UDP in every environment and travel in development and staging. DVLA needs a linked licence and UNS a registered push id, so neither has a probe yet. Until they do, C4 and C5 depend on real traffic.
- Latency SLOs per journey are not set. The 3 second p95 warning stands until production baselines exist.
- No pager. Critical alerts are Slack messages until a paging tool is agreed.

---

## Related

- [Verify Environment Health](/docs/runbooks/verify-environment-health.md)
- [API Gateway 5xx](/docs/runbooks/api-gateway-5xx.md)
- [External Service Outage](/docs/runbooks/external-service-outage.md)
- [Lambda Errors or Throttling Alarm](/docs/runbooks/lambda-errors-throttling-alarm.md)
- [Alarm Relay Failure](/docs/runbooks/alarm-relay-failures.md)
- [IAM change alerts](/docs/iam-change-alerts.md)
