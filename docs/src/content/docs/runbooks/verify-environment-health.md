---
title: Verify environment health
description: Confirm an environment is healthy after a deployment, or find where it is unhealthy.
---

Use this runbook to confirm an environment is healthy after a deployment, to investigate a failed
deployment, or to start an investigation when you do not yet know what is wrong. Do the
[before you start](/flex/runbooks/overview/#before-you-start) steps first.

No single check means healthy. A passing smoke test, no alarms firing and every stack in a complete
state together give confidence. Work through the checks in order, from the strongest signal, and
stop when you find the cause.

Personal and PR stages have no smoke test. Their alarms post to the development channel.

## 1. Check the smoke test

The smoke test alarm never posts to Slack, so check it by hand. It only exists in `development`,
`staging` and `production`. See [The smoke test](/flex/observability/alarms/#the-smoke-test) for
what it covers.

1. Read the alarm state:

   ```bash
   aws cloudwatch describe-alarms \
     --alarm-names "${STAGE}-smoke-test-no-success" \
     --query "MetricAlarms[0].{State:StateValue,Since:StateUpdatedTimestamp}" \
     --output table \
     --region eu-west-2
   ```

2. Read the last two hours of results, because the alarm only fires after about three failures in a
   row:

   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace Flex/SmokeTest \
     --metric-name SmokeTestSuccess \
     --dimensions Name=Environment,Value=${STAGE} \
     --start-time "$(date -u -d '2 hours ago' +%FT%TZ)" \
     --end-time "$(date -u +%FT%TZ)" \
     --period 300 \
     --statistics Sum \
     --output table \
     --region eu-west-2
   ```

   A `1.0` in every 5 minute period is healthy. A `0.0` or a gap is a failed run.

3. For a failed run, read the smoke test Lambda's logs. Its log group is a resource of the
   `${STAGE}-FlexSmokeTest` stack. Search for `Smoke test failed`, which logs the error.

   ```bash
   aws cloudformation describe-stack-resources \
     --stack-name "${STAGE}-FlexSmokeTest" \
     --query "StackResources[?ResourceType=='AWS::Logs::LogGroup'].PhysicalResourceId" \
     --output text \
     --region eu-west-2
   ```

4. Decide what failed. A failure to get a token, such as an expired test user password or a missing
   SSM parameter, is a fault in the smoke test, not an outage. An `API call failed: <status>` error
   means the route itself failed: go to [API Gateway 5xx](/flex/runbooks/api-gateway-5xx/) for a 5xx.

## 2. Check for alarms firing

1. List the alarms in `ALARM` in both regions:

   ```bash
   for region in eu-west-2 us-east-1; do
     aws cloudwatch describe-alarms \
       --alarm-name-prefix "${STAGE}-" \
       --state-value ALARM \
       --query "MetricAlarms[].{Alarm:AlarmName,Since:StateUpdatedTimestamp}" \
       --output table \
       --region "$region"
   done
   ```

2. Read recent messages in the environment's alerting channel. You can ask Amazon Q in the channel
   about an alarm or a log group.
3. For each alarm, go to the runbook for its type. [Alarm names](/flex/observability/alarms/#alarm-names)
   tells you what each prefix is.

The relay health alarms (`${STAGE}-flex-alarm-relay-`) are in the `us-east-1` list but notify
nobody. If one is in `ALARM`, edge alerts may be missing from Slack: follow
[Alarm relay failures](/flex/runbooks/alarm-relay-failures/).

## 3. Check the stacks

CloudFormation knows whether a deployment applied, not whether the code works. A deployment can apply
some stacks and fail on another, leaving a mix of old and new.

1. List the stage's stacks and their status in both regions:

   ```bash
   for region in eu-west-2 us-east-1; do
     aws cloudformation list-stacks \
       --query "StackSummaries[?StackStatus!='DELETE_COMPLETE' && starts_with(StackName, '${STAGE}-')].{Name:StackName,Status:StackStatus}" \
       --output table \
       --region "$region"
   done
   ```

   A full deployment of a persistent environment has `FlexCore`, `FlexSmokeTest`,
   `FlexCloudWatchDashboards`, `FlexPlatform`, `FlexApiDeployment` and one stack per deployed
   domain in `eu-west-2`, and `FlexGlobal` and `FlexMacie` in `us-east-1`. A personal or PR stage
   has only `FlexPlatform`, `FlexApiDeployment`, its domain stacks and `FlexGlobal`. Service
   gateways are part of `FlexPlatform`. See [Infrastructure](/flex/infrastructure/overview/).

2. Act on the status:

   | Status | Meaning | Action |
   |---|---|---|
   | `CREATE_COMPLETE`, `UPDATE_COMPLETE` | Applied | Healthy |
   | `UPDATE_ROLLBACK_COMPLETE` | Failed and rolled back. The change is not live. | Read the failed run, then [fix forward](/flex/runbooks/fix-forward/). |
   | `UPDATE_FAILED` | Failed, rollback not finished | Read the stack events, then fix forward. |
   | `UPDATE_ROLLBACK_FAILED` | The rollback failed. The stack is stuck. | [Escalate](/flex/runbooks/overview/#escalating). It needs admin access. |
   | Any `_IN_PROGRESS` | A deployment is running | Check the pipeline run. Wait for it to finish before deploying or retrying. |

3. For a stack that failed, find the resource that failed:

   ```bash
   aws cloudformation describe-stack-events \
     --stack-name "${STAGE}-FlexPlatform" \
     --max-items 50 \
     --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED'].{Resource:LogicalResourceId,Reason:ResourceStatusReason}" \
     --output table \
     --region eu-west-2
   ```

   Change the stack name for any other stack, and the region to `us-east-1` for `FlexGlobal`. You
   can also read the events in the CloudFormation console: **Stacks** > the stack > **Events**.

## 4. Check what the smoke test does not cover

Reach for this once the checks above are clean and you still suspect a problem, such as users
reporting errors with no alarm firing.

1. Open the X-Ray trace map for the stage and look for nodes with errors, faults or throttles. See
   [Traces](/flex/runbooks/overview/#traces).
2. Search the affected domain's or service gateway's log group in CloudWatch Logs Insights for the
   [shared log messages](/flex/runbooks/overview/#logs), especially `flex-fetch retrying request`
   and `flex-fetch failed`.
3. In production, open the dashboards (`production-flex-driving-dashboard`,
   `production-flex-udp-dashboard`) in **CloudWatch** > **Dashboards** to see per-route errors and
   latency for DVLA and UDP.
4. Run the platform and domain E2E suites against the stage. See
   [Reproducing with the E2E suites](/flex/runbooks/overview/#reproducing-with-the-e2e-suites).

## Common findings

| You see | Likely cause | Go to |
|---|---|---|
| Smoke test alarm in `ALARM`, nothing in Slack | Expected: the smoke test alarm has no action | [Step 1](#1-check-the-smoke-test) |
| Smoke test failing to get a token | A fault in the smoke test's credentials or configuration, not an outage | Fix the smoke test configuration |
| Smoke test `OK`, but a domain is failing | A route the smoke test does not cover | [Step 4](#4-check-what-the-smoke-test-does-not-cover) |
| Integration latency high, API Gateway overhead flat | A slow dependency behind Flex | [External service outage](/flex/runbooks/external-service-outage/) |
| More `flex-fetch retrying request`, no alarm yet | A dependency starting to struggle | [External service outage](/flex/runbooks/external-service-outage/) |
| `Gateway response schema validation failed`, 502s from one gateway | The upstream changed its response shape | [Fix forward](/flex/runbooks/fix-forward/) |
| 403s from UDP or UNS | A cross-account role or trust policy fault on the Flex side | [Fix forward](/flex/runbooks/fix-forward/) |
| A stack in `UPDATE_ROLLBACK_COMPLETE` or `UPDATE_FAILED` | A failed deployment. The change is not live. | [Step 3](#3-check-the-stacks), then [Pipeline](/flex/delivery/pipeline/) |
| No alarms, users reporting problems | A path no alarm or smoke test covers | [Step 4](#4-check-what-the-smoke-test-does-not-cover). Raise a ticket for the missing alarm. |

## After a production deployment

Development and staging run the platform E2E tests after deploying. Production does not, so after a
production deployment watch `govuk-once-flex-alerting-production` for at least 10 minutes, and run
steps 1 to 3. Most alarms evaluate over 5 minute periods, so a fault the deployment introduced shows
up within that time. See [Pipeline](/flex/delivery/pipeline/).
