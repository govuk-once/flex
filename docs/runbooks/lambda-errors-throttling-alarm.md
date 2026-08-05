# Lambda Error Rate, Throttling or Duration Alarm

Use this runbook to investigate and respond to a Lambda error rate, throttles or duration
alarm on the AWS FLEX platform.

Alternatively, go to the [Runbooks](/docs/runbooks/README.md) page to find available runbooks.

## Scope

Covers all FLEX Lambda functions, not just the ones behind API Gateway. It does not cover API Gateway 5xx errors caused by a handler as a returned 500/502 is a successful invocation from Lambda's perspective.

> Personal and PR stacks are also included given the same alarms and thresholds apply for all environments, they will route to `govuk-once-flex-alerting-dev`.

---

## Prerequisites

- Read-only role must be assumed for the target team and environment via the GDS CLI, see [Environment Setup Guide](/docs/environment-setup.md#aws-configuration-using-gds-cli).
- Region is `eu-west-2`.
- Access to the target environment's alerting Slack channel, see [Related](#related).

> Edge resources (CloudFront, CloudFront Functions, WAF, Shield) are located in `us-east-1`. All alarms are sent to the same Slack channels, so you'll only need to change region when instructed.

Set the stage to ensure all commands are run against the correct stage:

```bash
export STAGE=<development|staging|production>
```

---

## What Each Alarm Measures

All three alarms are created together by the `LambdaAlarms` construct for every FLEX function. Names are `${STAGE}-<prefix>-<type>`, where the prefix is passed in by the call site and the type is one of `error-rate`, `throttles` or `duration`.

Alarms are opt-out. The function constructs take `enableDefaultAlarms`, which defaults to `true`, so a function that sets it to `false` has no alarms at all and will never page regardless of how it fails.

The prefix is derived from the CDK construct id in lowercase, which is not necessarily the deployed Lambda function name. List by prefix (step 1) rather than trying to derive a name from the function.

| Alarm        | Metric                                     | Threshold                       | Window                  | Missing data  | Severity |
| ------------ | ------------------------------------------ | ------------------------------- | ----------------------- | ------------- | -------- |
| `error-rate` | `100 * (Errors / Invocations)`, both `Sum` | `> 1%`, at 10+ invocations      | 2 x 5 min (both breach) | Not breaching | Critical |
| `throttles`  | `Throttles`, `Sum`                         | `> 0`                           | 1 x 1 min               | Not breaching | Critical |
| `duration`   | `Duration`, `p99`                          | `> 80%` of the function timeout | 1 x 5 min               | Not breaching | Warning  |

Which alarms fire together is usually a faster read than any single alarm:

| Pattern                                | Reading                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Duration first, then error rate        | Requests slowed until they hit the timeout, usually a slow downstream                            |
| Error rate alone, starting at a deploy | An init failure or crash introduced by the release, check `#govuk-once-flex-release`             |
| Duration alone                         | Early warning, nothing failing yet. Investigate before it becomes timeouts                       |
| Throttles alone                        | Concurrency exhausted, the function's own code is likely fine                                    |
| Throttles across many functions        | The account concurrency pool is exhausted. The consumer may not be any of the alarming functions |
| Error rate across many functions       | Something shared, such as a platform change or a common dependency, rather than one route        |

### Error rate

Counts invocations Lambda itself considers failed. A FLEX handler that catches an error and returns a 500/502 is a successful invocation and does not appear here, see step 2.

The expression is gated on a minimum invocation count (`IF(invocations >= 10, ...)`) and returns `0` below it, so a function with little or no traffic sits in `OK` rather than `INSUFFICIENT_DATA`.

> Treat this as an error count alarm rather than a rate alarm. With N invocations in a window, the smallest non-zero rate expressible is 100/N%, so at the 10 invocation gate one failed invocation is already 10%. The 1% threshold is only literal above 100 invocations per window. Check the actual `Errors` and `Invocations` counts in `StateReason` (step 1) rather than assuming a 1% regression was measured.

Below 10 invocations in the window the alarm cannot fire. If a failure is reported on a near-idle function with no alarm, check the `Errors` metric directly rather than assuming there was none.

> Two consecutive windows must breach, so an isolated failure does not page. This adds detection latency, an outage failing 100% of invocations takes around 10 minutes to alarm. Assume the problem started at least one window before the alarm timestamp when setting up log and metric queries.

### Throttles

Fires on a single throttled invocation in any 1 minute window. This is a critical alarm as dropped invocations are user impacting, and on synchronous routes the caller receives a 429 rather than a handled error.

Because there is no smoothing, a brief burst that Lambda absorbs within a minute will still page. Check the `Throttles` count in `StateReason` and the concurrency groupings in step 4 to tell a one-off scaling burst from sustained capacity pressure.

> A throttled invocation never runs, so it writes no logs. There is nothing to find in Logs Insights for this alarm. Work from the metrics instead, the function's Monitoring tab in the Lambda console shows `Throttles` and `ConcurrentExecutions` alongside invocations.

No FLEX function sets reserved or provisioned concurrency, so every function in an environment draws from the account's shared regional pool, and in development that pool is shared with all personal and PR stacks. Throttling is often not caused by the alarming function, see the account-level concurrency grouping in step 4 before assuming it is.

### Duration

Fires at 80% of the function's configured timeout, as an early warning before invocations start timing out.

There is no default threshold. The construct fails at synth if a function has no explicit timeout, so the threshold always tracks a chosen value. It varies per function, confirm the real timeout from the `list-functions` output in step 1 before judging whether a p99 is close to the limit.

> The `Duration` metric measures the invoke phase only. Cold start initialisation is reported separately as `Init Duration` and has its own budget, it does not consume the configured function timeout. It does add to the latency the caller experiences, so client-side latency and API Gateway 504s can exceed anything this alarm measures. Check `@initDuration` in the logs (step 3) when latency is reported but the duration alarm is quiet.

When a function does time out, `Duration` lands at roughly the timeout value, so the duration alarm and the error rate alarm normally fire together.

### Reading the Slack alert

Alarms reach Slack via Amazon Q Developer in chat applications, which subscribes to the alarm's SNS topic and posts into the alerting channel for the environment, see [Related](#related).

The posted message carries everything needed to start:

- **Alarm name**, gives you the stage and the alarm type, with the construct prefix in between.
- **State change**, `OK -> ALARM` is a new incident. `ALARM -> OK` is a recovery, check whether anyone is still working it before standing down.
- **Reason**, includes the datapoint values, for example the observed error rate or p99. This is the fastest read on whether the breach is marginal or severe.
- **Timestamp**, anchor for the log and metric queries below, and for correlating against `#govuk-once-flex-release`.

---

## Steps

1. **Confirm the alarm and its state:**

List everything currently firing for the stage rather than guessing alarm names:

```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix "${STAGE}-" \
  --state-value ALARM \
  --query "MetricAlarms[].{Name:AlarmName,Since:StateUpdatedTimestamp,Reason:StateReason}" \
  --output table \
  --region eu-west-2
```

Once you have a name from the output, confirm the full set for that function by taking everything before the alarm type as the prefix:

```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix "${STAGE}-<prefix>" \
  --query "MetricAlarms[].{Name:AlarmName,State:StateValue,Since:StateUpdatedTimestamp,Reason:StateReason}" \
  --output table \
  --region eu-west-2
```

Confirm the alarms exist before assuming whether they'd fired or not. A function with fewer than three rows either has `enableDefaultAlarms` set to `false` or was never deployed with them, neither of which means it is healthy. If a failure is reported against a function with no alarms, go straight to the metrics and logs.

`StateReason` contains the breaching datapoint values, read it before opening the console.

If the alarm has already returned to `OK`, recover the history:

```bash
aws cloudwatch describe-alarm-history \
  --alarm-name "${STAGE}-<prefix>-error-rate" \
  --history-item-type StateUpdate \
  --max-records 10 \
  --query "AlarmHistoryItems[].{When:Timestamp,Summary:HistorySummary}" \
  --output table \
  --region eu-west-2
```

Resolve the construct id to the deployed function name, needed for the log group and metric queries:

```bash
aws lambda list-functions \
  --query "sort_by(Functions[?starts_with(FunctionName, '${STAGE}-')], &FunctionName)[].{Name:FunctionName,Timeout:Timeout,Memory:MemorySize}" \
  --output table \
  --region eu-west-2
```

Note the `Timeout` value, it is needed to check the duration alarm threshold.

Set the function name for the log and metric commands in steps 3 and 4:

```bash
export FUNCTION=<function-name-from-above>
```

2. **Verify invocation failure:** FLEX handlers return an HTTP error response and is considered a successful invocation. A firing alarm means something failed before or outside the catch, examples include:

- Import failure
- Middy resource failed to resolve (e.g., Secrets Manager/SSM)
- Unhandled rejection
- Timeout

Behind API Gateway these surface to the caller as a native gateway response with no matching FLEX log line for the request:

| Caller sees | Failure mode                |
| ----------- | --------------------------- |
| 502         | Crash or malformed response |
| 503         | Throttle                    |
| 504         | Timeout                     |

A reported 5xx that does have a FLEX log line for the request is a handled error, which belongs to the API Gateway 5xx runbook rather than this one.

3. **Check the logs** (CloudWatch Logs Insights, log groups):

Resolve the log group for the function rather than assuming the default path:

```bash
aws lambda get-function-configuration \
  --function-name "${FUNCTION}" \
  --query "LoggingConfig.LogGroup" \
  --output text \
  --region eu-west-2
```

To search more than one function at once, select the log groups directly in the Insights log group selector.

Common search terms, and why they matter:

| Term                                           | Cause                             | Why it matters                                                                                    |
| ---------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Task timed out after`                         | Timeout                           | Confirms a timeout rather than a crash. Pull the `@requestId` and trace what it was waiting on    |
| `Runtime exited with error` / `signal: killed` | Process died                      | Usually out of memory. Cross-check `@maxMemoryUsed` against the configured memory                 |
| `UnhandledPromiseRejection`                    | Async rejection outside the catch | A promise not awaited by the handler, the common cause of an error alarm alongside a 200 response |
| `AccessDenied` / `ResourceNotFoundException`   | Middy resource resolution failed  | Missing IAM grant, or a secret/parameter that doesn't exist in this stage. Often stage-specific   |
| `ThrottlingException` / `Rate exceeded`        | Downstream throttling             | A dependency rate-limiting FLEX, not Lambda throttling. Do not confuse with the throttles alarm   |
| `errorType` / `errorMessage`                   | Structured Lambda error payload   | The runtime's own error envelope, the best field for grouping distinct failure modes              |

Run these in Logs Insights against the log group resolved above.

List recent failures and identify the failure mode:

```
fields @timestamp, @requestId, @message
| filter @message like /Task timed out|UnhandledPromiseRejection|Runtime exited/
| sort @timestamp desc
| limit 50
```

Count occurrences by distinct error to see how often each one happens:

```
fields @timestamp, errorType, errorMessage
| filter ispresent(errorType)
| stats count(*) as occurrences by errorType, errorMessage
| sort occurrences desc
```

Check duration, cold starts and memory headroom in one pass, use this for a duration alarm:

```
filter @type = "REPORT"
| stats count(*) as invocations,
        avg(@duration) as avgMs,
        pct(@duration, 99) as p99Ms,
        max(@duration) as maxMs,
        count(@initDuration) as coldStarts,
        max(@initDuration) as maxInitMs,
        max(@maxMemoryUsed / 1000000) as maxMemoryMB
  by bin(5m)
| sort @timestamp desc
```

If `coldStarts` tracks the duration spikes, the alarm is cold start driven rather than a regression in the handler.

Once you have a failing `@requestId`, pull its full trace:

```
fields @timestamp, @message
| filter @requestId = "<request-id>"
| sort @timestamp asc
```

4. **Check the metrics**

Graph these together, at a 1-minute period, over a window that starts before the alarm timestamp. Grouping them separates causes from symptoms:

| Group together                                                                                       | What it tells you                                                                                               |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Invocations` + `Errors` (both `Sum`)                                                                | Whether the error rate reflects real volume or one failure on a near-idle function. Check this first on dev     |
| `Throttles` + `ConcurrentExecutions` (`Max`) for the function                                        | Whether throttling is this function hitting its own reserved concurrency                                        |
| Account-wide `ConcurrentExecutions` + `UnreservedConcurrentExecutions` (no `FunctionName` dimension) | Whether throttling is regional pressure from a different function, which is the account-level case, escalate    |
| `Duration` p50 / p90 / p99 / `Maximum`, against the timeout                                          | A rising p99 with a flat p50 is a tail problem such as a slow dependency or cold starts, not a broad regression |
| `Errors` + deploy times from `#govuk-once-flex-release`                                              | Whether the failure starts at a deployment boundary                                                             |
| `AsyncEventsReceived` + `AsyncEventsDropped` + `AsyncEventAge`                                       | For non-API-Gateway functions, whether retries are exhausting and events are being dropped silently             |

Pull the core four from the CLI:

```bash
aws cloudwatch get-metric-data \
  --region eu-west-2 \
  --start-time "$(date -u -v-2H +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --metric-data-queries "$(cat <<JSON
[
  {"Id":"invocations","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Invocations","Dimensions":[{"Name":"FunctionName","Value":"${FUNCTION}"}]},"Period":60,"Stat":"Sum"}},
  {"Id":"errors","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Errors","Dimensions":[{"Name":"FunctionName","Value":"${FUNCTION}"}]},"Period":60,"Stat":"Sum"}},
  {"Id":"throttles","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Throttles","Dimensions":[{"Name":"FunctionName","Value":"${FUNCTION}"}]},"Period":60,"Stat":"Sum"}},
  {"Id":"p99","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Duration","Dimensions":[{"Name":"FunctionName","Value":"${FUNCTION}"}]},"Period":60,"Stat":"p99"}}
]
JSON
)" \
  --output table
```

> On Linux, use `date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ` instead.

Check account-level concurrency headroom when investigating throttling:

```bash
aws lambda get-account-settings \
  --query "AccountLimit.{Concurrent:ConcurrentExecutions,Unreserved:UnreservedConcurrentExecutions}" \
  --output table \
  --region eu-west-2
```

5. **Check the traces**

Active tracing is enabled on FLEX Lambdas, so X-Ray separates a slow function from a slow dependency, which the metrics alone cannot do. The service map flags errors, faults and throttles per node. Open a trace for a failing or slow request and read which downstream segment consumed the time.

Filter to the failing traces for the function:

```bash
aws xray get-trace-summaries \
  --start-time "$(date -u -v-2H +%s)" \
  --end-time "$(date -u +%s)" \
  --filter-expression "service(\"${FUNCTION}\") AND (error OR fault)" \
  --query "TraceSummaries[].{Id:Id,Duration:Duration,Response:ResponseTime,Fault:HasFault,Error:HasError}" \
  --output table \
  --region eu-west-2
```

Then pull a single trace by id:

```bash
aws xray batch-get-traces \
  --trace-ids <trace-id> \
  --region eu-west-2
```

---

## Resolve or Mitigate

| Cause                       | Response                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeout                     | Consider changing the route timeout or identify the downstream service causing the issue and fix forward                                                                        |
| Resource resolution failure | Identify the misconfigured reference and fix forward                                                                                                                            |
| Unhandled exception         | Check `#govuk-once-flex-release` for the deployment around the time of failure, identify and fix the issue                                                                      |
| Throttling                  | Likely caused by concurrency limits, identify the function causing this                                                                                                         |
| Import or handler failure   | Every invocation fails. Treat as an outage in staging or production, roll back the deployment first then fix forward                                                            |
| Out of memory               | Compare `@maxMemoryUsed` to the configured memory and raise it, or find what is being held in memory                                                                            |
| Cold start driven duration  | Correlate `@initDuration` occurrences with the spikes. `Duration` excludes init, so the cause is first-invocation work such as lazy imports, TLS handshakes or connection setup |
| Errors across two windows   | Check the `Errors` and `Invocations` counts in `StateReason`. Two consecutive breaching windows means the failure persisted for 10 minutes, treat it as real rather than a blip |

Timeout and memory are set per route in the domain's own config, the platform default timeout is 10s. Raising a timeout is a mitigation rather than a fix, and it is not free: a longer timeout holds a concurrency slot for longer, which can turn a slow downstream into a throttling incident for every function in the account.

Reserved concurrency is not an incident action. None is configured today, and adding it both caps the function it protects and shrinks the shared pool for everything else.

Escalate to `govuk-once-flex-developers` when:

- The root cause sits at the account level and requires admin access.
- The root cause can't be identified, or cannot be resolved following the steps above while impacting the production environment.
- Throttling traces back to account-level concurrency consumed by another team's function.

---

## After Recovery

1. Confirm all three alarms have returned to `OK` and stayed there. For throttling, confirm account concurrency has fallen back to its normal band rather than just below the limit.
2. Reconcile any changes made during the incident so the domain config matches what is deployed.
3. Raise follow up work for anything the incident exposed, such as a function that needs profiling, a retrying client, a missing alarm, or a concurrency quota with no headroom.
4. Feed anything you worked out under pressure back into this runbook.

## Related

**Slack Channels:**

- `govuk-once-flex-alerting-dev`
- `govuk-once-flex-alerting-staging`
- `govuk-once-flex-alerting-production`
- `govuk-once-flex-release`

**Guides:**

- [Runbooks](/docs/runbooks/README.md)
- [Deployment Guide](/docs/deployment.md)
- [Environment Setup Guide](/docs/environment-setup.md)
