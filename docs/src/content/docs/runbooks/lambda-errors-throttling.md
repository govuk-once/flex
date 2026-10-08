---
title: Lambda errors or throttling
description: Respond to a Lambda error-rate, throttles or duration alarm on a Flex function.
---

Use this runbook when a Lambda `error-rate`, `throttles` or `duration` alarm fires. It covers every
Flex function: domain routes, service gateways, the Lambda authorizer and the DVLA secret rotation
function. Do the [before you start](/flex/runbooks/overview/#before-you-start) steps first.

What each alarm measures, and its quirks at low traffic, are in
[Lambda functions](/flex/observability/alarms/#lambda-functions). Read that first if you have not
met these alarms before.

This alarm counts failed invocations. A handler that catches an error and returns a 500 or 502 is a
successful invocation and does not appear here: that is the
[API Gateway 5xx](/flex/runbooks/api-gateway-5xx/) runbook.

## Read the pattern first

Which alarms fired together is often the fastest clue:

| Pattern | Reading |
|---|---|
| `duration`, then `error-rate` | Requests slowed until they hit the timeout. Usually a slow dependency. |
| `error-rate` alone, starting at a deployment | An init failure or crash the release introduced. |
| `duration` alone | Early warning. Nothing is failing yet. |
| `throttles` alone | Concurrency ran out. The function's code is probably fine. |
| `throttles` on many functions | The account's concurrency pool ran out. The cause may be a function that is not alarming. |
| `error-rate` on many functions | Something shared: a platform change or a common dependency. |

## Steps

1. **Confirm the alarm and read its reason.** List what is firing:

   ```bash
   aws cloudwatch describe-alarms \
     --alarm-name-prefix "${STAGE}-" \
     --state-value ALARM \
     --query "MetricAlarms[].{Name:AlarmName,Since:StateUpdatedTimestamp,Reason:StateReason}" \
     --output table \
     --region eu-west-2
   ```

   `StateReason` holds the datapoints. For `error-rate`, check the real `Errors` and `Invocations`
   counts before treating it as a 1% regression. Then list all three alarms for the function, using
   everything before `-error-rate`, `-throttles` or `-duration` as the prefix:

   ```bash
   aws cloudwatch describe-alarms \
     --alarm-name-prefix "${STAGE}-<function id>-alarm" \
     --query "MetricAlarms[].{Name:AlarmName,State:StateValue,Since:StateUpdatedTimestamp,Reason:StateReason}" \
     --output table \
     --region eu-west-2
   ```

   Fewer than three alarms means the function has `enableDefaultAlarms: false`, or was never
   deployed with them. That does not mean it is healthy. If the alarm has already cleared, read its
   history with the command in [Finding alarms from the CLI](/flex/observability/alarms/#finding-alarms-from-the-cli).

2. **Find the deployed function.** The alarm name holds the construct id, not the function name.
   Deployed names start with the stack name, such as `production-udp-` for the `udp` domain:

   ```bash
   aws lambda list-functions \
     --query "sort_by(Functions[?starts_with(FunctionName, '${STAGE}-')], &FunctionName)[].{Name:FunctionName,Timeout:Timeout,Memory:MemorySize}" \
     --output table \
     --region eu-west-2

   export FUNCTION=<function name>
   ```

   Note the `Timeout`. The `duration` threshold is 80% of it.

3. **Find the failure mode in the logs.** Get the log group with the command in
   [Logs](/flex/runbooks/overview/#logs), then run these in CloudWatch Logs Insights, starting the
   time range at least one period before the alarm.

   List recent failures:

   ```text
   fields @timestamp, @requestId, @message
   | filter @message like /Task timed out|Runtime exited|Runtime.ImportModuleError|errorType/
   | sort @timestamp desc
   | limit 50
   ```

   Count distinct errors:

   ```text
   fields @timestamp, errorType, errorMessage
   | filter ispresent(errorType)
   | stats count(*) as occurrences by errorType, errorMessage
   | sort occurrences desc
   ```

   Check duration, cold starts and memory, for a `duration` alarm:

   ```text
   filter @type = "REPORT"
   | stats count(*) as invocations,
           pct(@duration, 99) as p99Ms,
           max(@duration) as maxMs,
           count(@initDuration) as coldStarts,
           max(@initDuration) as maxInitMs,
           max(@maxMemoryUsed / 1000000) as maxMemoryMB
     by bin(5m)
   | sort @timestamp desc
   ```

   Then follow one failing request from start to end with
   `filter @requestId = "<request id>" | sort @timestamp asc`.

   | Log text | Cause |
   |---|---|
   | `Task timed out after` | The invocation hit its timeout. Find what it was waiting on. |
   | `Runtime exited with error`, `signal: killed` | The process died, usually out of memory. Compare `@maxMemoryUsed` with the configured memory. |
   | `Runtime.ImportModuleError`, or an `Environment variable "<key>" not set` error at init | The function cannot load. Every invocation fails. |
   | `ThrottlingException`, `Rate exceeded` | A dependency is rate limiting Flex. This is not Lambda throttling. |

   A throttled invocation never runs and writes no logs. For `throttles`, go to step 4.

4. **Check the metrics.** Pull invocations, errors, throttles and p99 duration at 1 minute
   resolution:

   ```bash
   aws cloudwatch get-metric-data \
     --start-time "$(date -u -d '2 hours ago' +%FT%TZ)" \
     --end-time "$(date -u +%FT%TZ)" \
     --metric-data-queries "$(cat <<JSON
   [
     {"Id":"invocations","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Invocations","Dimensions":[{"Name":"FunctionName","Value":"${FUNCTION}"}]},"Period":60,"Stat":"Sum"}},
     {"Id":"errors","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Errors","Dimensions":[{"Name":"FunctionName","Value":"${FUNCTION}"}]},"Period":60,"Stat":"Sum"}},
     {"Id":"throttles","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Throttles","Dimensions":[{"Name":"FunctionName","Value":"${FUNCTION}"}]},"Period":60,"Stat":"Sum"}},
     {"Id":"p99","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Duration","Dimensions":[{"Name":"FunctionName","Value":"${FUNCTION}"}]},"Period":60,"Stat":"p99"}}
   ]
   JSON
   )" \
     --output table \
     --region eu-west-2
   ```

   For throttling, compare with the account's concurrency. In the console, open **CloudWatch** >
   **Metrics** > **Lambda** > **Across All Functions** and graph `ConcurrentExecutions` (maximum)
   against the account limit:

   ```bash
   aws lambda get-account-settings \
     --query "AccountLimit.{Concurrent:ConcurrentExecutions,Unreserved:UnreservedConcurrentExecutions}" \
     --output table \
     --region eu-west-2
   ```

   No Flex function sets reserved concurrency, so every function in an account shares the
   unreserved pool. In development that pool is shared with every personal and PR stage. In staging
   and production each service gateway keeps 2 provisioned concurrent executions on its `live`
   alias, which also come out of the pool.

5. **Check the traces** for a slow or failing request, to see whether the time went in the function
   or in a dependency. See [Traces](/flex/runbooks/overview/#traces). From the CLI:

   ```bash
   aws xray get-trace-summaries \
     --start-time "$(date -u -d '2 hours ago' +%s)" \
     --end-time "$(date -u +%s)" \
     --filter-expression "service(\"${FUNCTION}\") AND (error OR fault)" \
     --query "TraceSummaries[].{Id:Id,Duration:Duration,Fault:HasFault,Error:HasError}" \
     --output table \
     --region eu-west-2
   ```

## Resolve or mitigate

| Cause | Response |
|---|---|
| Init or import failure | Every invocation fails. In staging or production, revert the change that introduced it. See [Fix forward](/flex/runbooks/fix-forward/). |
| Timeout from a slow dependency | Follow [External service outage](/flex/runbooks/external-service-outage/). |
| Timeout in the function's own work | Fix forward, or raise the route's timeout as a mitigation. |
| Out of memory | Raise the memory, or find what is held in memory. |
| Cold starts driving `duration` | Correlate `@initDuration` with the spikes. Look at work done on first invocation, such as imports and connection set-up. |
| Throttling from this function's own traffic | Find the source of the traffic. Escalate if the account limit needs raising. |
| Throttling from another function | Find the function using the concurrency. [Escalate](/flex/runbooks/overview/#escalating) if it belongs to another team or the limit needs raising. |

Timeout and memory are set per route in the domain configuration, with `function.timeoutSeconds`
and `function.memorySize`. The default timeout for a domain route is 15 seconds, and service
gateways have 30 seconds. See [Domain configuration](/flex/domains/configuration/). A longer timeout
is a mitigation, not a fix: it holds a concurrency slot for longer, and can turn a slow dependency
into throttling for every function in the account.

Do not add reserved concurrency during an incident. It caps the function it is set on and shrinks
the pool for everything else.

## After recovery

Confirm all three alarms for the function are back in `OK`. For throttling, confirm account
concurrency has fallen back to its normal level, not just under the limit. Then follow
[After recovery](/flex/runbooks/overview/#after-recovery).
