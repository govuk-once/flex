---
title: API Gateway 5xx
description: Find where a 5xx from the Flex APIs came from, and fix or escalate it.
---

Use this runbook when a `5xx-error-rate` alarm fires on the public API (`${STAGE}-apigw-`) or the
private API (`${STAGE}-apigw-private-`), or when callers report 5xx responses. Do the
[before you start](/flex/runbooks/overview/#before-you-start) steps first. The alarm's threshold is
in [API Gateway](/flex/observability/alarms/#api-gateway).

A 5xx means something behind API Gateway failed, almost never API Gateway itself. The status code is
the first clue to where.

## Where a 5xx comes from

A public request runs CloudFront, API Gateway, the domain Lambda, then optionally the private API, a
service gateway Lambda and the third party. A 5xx is either a response a Flex handler returned on
purpose, which it logs, or one API Gateway produced because the Lambda did not return a usable
response, which no Flex log line explains.

| Status | Produced by | Meaning |
|---|---|---|
| 500 | Domain handler | An unexpected error (`Unhandled error`), a response that failed its schema (`Response validation failed`), or a 5xx the handler threw on purpose. |
| 500 | Service gateway | An unexpected error in the gateway (`Internal server error`). |
| 502 | Service gateway | The upstream returned a 5xx (`<NAME> upstream service unavailable`), or its response failed the route's schema (`<NAME> upstream response invalid`). `<NAME>` is the gateway in capitals. |
| 502 | API Gateway | The Lambda raised an error, crashed, ran out of memory, hit its own timeout or returned a malformed response. |
| 504 | API Gateway | The integration took longer than 29 seconds, API Gateway's integration timeout. Only a function with a longer timeout can cause it: service gateways have 30 seconds, as do several domains. |

A gateway's 502 reaches the domain through the private API. What the public caller sees then depends
on how the domain handles the integration's failure. See
[Error responses](/flex/domains/handlers/#error-responses).

The split that matters: a handler's 500 or 502 has a matching error in the Lambda's logs. API
Gateway's own 502 or 504 has no Flex log line for the request, because the handler never returned.

## Steps

1. **Find the status codes and routes.** The alarm does not separate 500 from 504. Find the access
   log group, which starts with the platform stack name:

   ```bash
   aws logs describe-log-groups \
     --log-group-name-prefix "${STAGE}-FlexPlatform-" \
     --query "logGroups[].logGroupName" \
     --output text \
     --region eu-west-2
   ```

   The public API's starts `${STAGE}-FlexPlatform-ApiAccessLogs` and the private API's starts
   `${STAGE}-FlexPlatform-AccessLogGroup`. Query it in CloudWatch Logs Insights:

   ```text
   fields @timestamp, status, httpMethod, resourcePath, requestId
   | filter status >= 500
   | stats count(*) as requests by status, httpMethod, resourcePath
   | sort requests desc
   ```

2. **Read the spread.**

   | Spread | Points at |
   |---|---|
   | 504s on one route | A slow or hanging dependency. |
   | 500s across many routes | Something shared: a resource, configuration, or a platform change. |
   | 502s on routes that call one service gateway | That gateway's upstream. |
   | Errors starting at a deployment | The deployment. Check the deployment notifications. |

3. **Find the matching Lambda logs.** Open the log group of the route's domain function, or of the
   service gateway for a `/gateways/<name>/` route on the private API. See
   [Logs](/flex/runbooks/overview/#logs) to find it. Search the incident window for the shared
   log messages:

   ```text
   fields @timestamp, level, message, correlation_id, url, detail.message
   | filter level = "ERROR"
   | sort @timestamp desc
   | limit 100
   ```

   Every request through CloudFront carries an `x-correlation-id`, which the CloudFront Function
   sets, and domain logs record it as `correlation_id`. Use it to follow one request across the
   domain and gateway logs.

   If you find a Flex error for the failing requests, the handler or its integration is at fault.
   If you find nothing, API Gateway produced the 5xx: go to
   [Lambda errors or throttling](/flex/runbooks/lambda-errors-throttling/).

4. **Check the metrics.** In **CloudWatch** > **Metrics** > **ApiGateway**, graph `5XXError`,
   `Latency` and `IntegrationLatency` for the API over the incident window. Rising integration
   latency with a flat gap to `Latency` means the time goes behind API Gateway. Check the function's
   `Errors`, `Duration` and `Throttles` in **Lambda** > **Functions** > the function > **Monitor**.
   Throttles above zero alongside 5xx point at concurrency, not code.

5. **Check the traces** to see how far a failing request got. See
   [Traces](/flex/runbooks/overview/#traces).

## Common causes

| Cause | How it presents | Response |
|---|---|---|
| Unhandled exception | 500s with `Unhandled error` and a stack, often from a deployment | Revert or fix forward. See [Fix forward](/flex/runbooks/fix-forward/). |
| Missing or wrong configuration | 500s or 502s across routes, starting at a deployment | Correct the SSM parameter, secret, role or environment variable, then fix forward. |
| Response schema failure | 500s with `Response validation failed`, or 502s with `Gateway response schema validation failed` | A contract defect, not an outage. Fix forward. |
| Dependency failing | 502s with `upstream service unavailable`, `flex-fetch failed` | Follow [External service outage](/flex/runbooks/external-service-outage/). |
| Dependency slow | 504s, `duration` alarms, high integration latency | Follow [External service outage](/flex/runbooks/external-service-outage/). |
| Throttling | 5xx with Lambda `Throttles` above zero | Follow [Lambda errors or throttling](/flex/runbooks/lambda-errors-throttling/). |

A 500 from Flex's own code is a fix forward, not an escalation. Escalate when the fault is outside
Flex, such as a failing dependency or an account limit, or when impact is severe and no Flex-side
change restores the journey. See [Escalating](/flex/runbooks/overview/#escalating).

Do not retry harder against a dependency that is down. It adds load and latency without helping.

## After recovery

Confirm the `5xx-error-rate` alarm is back in `OK` and the access log shows the affected routes
answering normally. Then follow [After recovery](/flex/runbooks/overview/#after-recovery).
