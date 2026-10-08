---
title: Alarms
description: Every CloudWatch alarm Flex defines, what it measures, where it notifies, and the smoke test, alarm relay and dashboards.
---

Flex defines its alarms in CDK, in
[`platform/infra/flex/src/constructs/alarms`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/constructs/alarms).
Almost every alarm has a severity, critical or warning, and notifies the alerting Slack channel
for its environment. The exceptions are the smoke test and alarm relay health alarms. This page is the reference for all of them. The [runbooks](/flex/runbooks/overview/)
say what to do when one fires.

## How an alert reaches Slack

```text
eu-west-2 alarm ───────────────────────────────────────────┐
                                                           ▼
                                  SNS flex-alerts-critical / flex-alerts-warning
us-east-1 alarm ─▶ relay topic ─▶ relay Lambda ──────────▶ (eu-west-2, FlexCore)
                                                           │
                                                           ▼
                                  Amazon Q Developer in chat applications
                                  channel configuration flex-alerts-<env>
                                                           │
                                                           ▼
                                  Slack alerting channel for the environment
```

The core stack (`<env>-FlexCore`) creates two SNS topics per environment, `flex-alerts-critical` and
`flex-alerts-warning`, encrypted with the KMS key `alias/flex-alerts-key`. A critical alarm
publishes to the critical topic and a warning alarm to the warning topic. One Amazon Q Developer in
chat applications (formerly AWS Chatbot) channel configuration, `flex-alerts-<env>`, subscribes to
both topics, so both severities post to the same channel. The alarm description starts with
`Critical:` or `Warning:` to tell them apart. Nothing pages anyone: Slack is the only destination.

The channel configuration has the `ReadOnlyAccess` managed policy as its guardrail, so you can ask
Amazon Q in the channel to read CloudWatch alarms, metrics and logs for that account.

| Environment | Slack channel |
|---|---|
| `development`, and every personal and PR stage | `govuk-once-flex-alerting-dev` |
| `staging` | `govuk-once-flex-alerting-staging` |
| `production` | `govuk-once-flex-alerting-production` |

The Slack workspace and channel IDs are not in this repository. The core stack reads them from the
SSM parameters `/<env>/flex-param/monitoring/slackWorkspaceId` and
`/<env>/flex-param/monitoring/slackChannelId`, which the `flex-params` repository provides.
Personal and PR stages have no core stack of their own. They import the development topics, so
their alarms post to the development channel with the same thresholds.

Release notifications use the same mechanism with their own topic and channel. See
[Releases](/flex/delivery/releases/).

### Reading an alert

An alert in Slack carries what you need to start:

| Part | What it tells you |
|---|---|
| Alarm name | The stage, the resource and the alarm type. See [Alarm names](#alarm-names). |
| State change | `OK` to `ALARM` is a new problem. `ALARM` to `OK` is a recovery: check whether anyone is still working on it before standing down. |
| Reason | The datapoint values that crossed the threshold, such as the observed error rate or p99. It shows how marginal or severe the breach is. |
| Timestamp | The anchor for log and metric queries, and for lining the problem up with a deployment. |

Most alarms evaluate over several periods, so the problem started at least one period before the
timestamp. Start log and metric queries earlier than the alert.

## Alarm names

Every alarm name starts with the stage. For a persistent environment the stage is the environment
name, so `production-...`.

| Prefix | Resource | Region | Stack |
|---|---|---|---|
| `<stage>-<function id>-alarm-` | Each Flex Lambda function | `eu-west-2` | The stack that owns the function |
| `<stage>-apigw-` | Public API Gateway | `eu-west-2` | `<stage>-FlexPlatform` |
| `<stage>-apigw-private-` | Private API Gateway | `eu-west-2` | `<stage>-FlexPlatform` |
| `<stage>-api-waf-` | Regional web ACL on the public API | `eu-west-2` | `<stage>-FlexPlatform` |
| `<stage>-smoke-test-no-success` | Smoke test | `eu-west-2` | `<env>-FlexSmokeTest` |
| `<stage>-cloudfront-` | CloudFront distribution | `us-east-1` | `<stage>-FlexGlobal` |
| `<stage>-cff-platform-`, `<stage>-cff-docs-` | CloudFront Functions | `us-east-1` | `<stage>-FlexGlobal` |
| `<stage>-cloudfront-waf-` | CloudFront web ACL | `us-east-1` | `<stage>-FlexGlobal` |
| `<stage>-shield-` | Shield Advanced protection | `us-east-1` | `<stage>-FlexGlobal` |
| `<stage>-flex-alarm-relay-` | Alarm relay health | `us-east-1` | `<stage>-FlexGlobal` |

The Lambda function id is the CDK construct id in lower case, not the deployed function name. For a
domain route it is the domain, API, version and route name joined together: the `upsert-user` route
on `GET /v1/users/me` in the `udp` domain has the id `udppublicv1upsertuser`, so its alarms are
`production-udppublicv1upsertuser-alarm-error-rate` and so on. A service gateway's id is
`<name>servicegateway`, the Lambda authorizer's is `authorizerfunction` and the DVLA secret
rotation function's is `dvlasecretrotation`.

## Finding alarms from the CLI

These commands need credentials for the target account. See
[AWS credentials](/flex/start/environment-setup/#aws-credentials).

```bash
export STAGE=<development|staging|production|your stage>

# Everything firing in eu-west-2, with the reason
aws cloudwatch describe-alarms \
  --alarm-name-prefix "${STAGE}-" \
  --state-value ALARM \
  --query "MetricAlarms[].{Name:AlarmName,Since:StateUpdatedTimestamp,Reason:StateReason}" \
  --output table \
  --region eu-west-2
```

Run it again with `--region us-east-1` for the edge alarms.

To see the threshold and evaluation settings of one alarm:

```bash
aws cloudwatch describe-alarms \
  --alarm-names "<alarm name>" \
  --query "MetricAlarms[0].{Threshold:Threshold,Comparison:ComparisonOperator,Period:Period,Evaluation:EvaluationPeriods,Datapoints:DatapointsToAlarm,Missing:TreatMissingData}" \
  --output table \
  --region eu-west-2
```

To recover the history of an alarm that has already returned to `OK`:

```bash
aws cloudwatch describe-alarm-history \
  --alarm-name "<alarm name>" \
  --history-item-type StateUpdate \
  --max-records 10 \
  --query "AlarmHistoryItems[].{When:Timestamp,Summary:HistorySummary}" \
  --output table \
  --region eu-west-2
```

## Alarm reference

Unless a row says otherwise, missing data is treated as not breaching, so an idle resource sits in
`OK`.

### Lambda functions

`LambdaAlarms`
([`lambda.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/constructs/alarms/lambda.ts))
creates three alarms for every function built with the Flex function constructs: every domain
route, every service gateway, the Lambda authorizer and the DVLA secret rotation function.

| Alarm | Measures | Fires when | Severity |
|---|---|---|---|
| `error-rate` | `100 * Errors / Invocations` over 5 minutes, or `0` below 10 invocations | Above 1% in 2 consecutive 5 minute periods | Critical |
| `throttles` | `Throttles`, sum over 1 minute | Above 0 in one period | Critical |
| `duration` | `Duration` p99 over 5 minutes | Above 80% of the function's timeout in one period | Warning |

Things to know when reading them:

- `Errors` counts failed invocations only. A Flex handler that catches an error and returns a 500
  is a successful invocation, so it does not count. See
  [Error responses](/flex/domains/handlers/#error-responses).
- The error rate is effectively an error count at low traffic. At 10 invocations one failure is 10%.
  The 1% threshold only means 1% above 100 invocations in a period. Below 10 invocations the alarm
  cannot fire at all.
- Two breaching periods are needed, so an outage failing every invocation takes about 10 minutes to
  alarm.
- One throttled invocation in a minute fires `throttles`. A throttled invocation never runs, so it
  writes no logs.
- The duration threshold is 80% of the function's own timeout. The construct refuses to synthesise
  a function without an explicit timeout. `Duration` excludes cold start initialisation
  (`Init Duration`).

The public and private egress constructs take `enableDefaultAlarms`, which defaults to `true`. A
function that sets it to `false` has no alarms. The smoke test function is the only one that does,
because the smoke test alarm covers it. The isolated construct always creates the alarms. See
[Lambda constructs](/flex/infrastructure/lambda-constructs/).

The alarm relay functions are plain Lambda functions without these alarms. They have their own
[relay health alarms](#alarm-relay-health).

### API Gateway

`ApiGatewayAlarms`
([`api-gateway.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/constructs/alarms/api-gateway.ts))
creates the same four alarms on the public API (`<stage>-apigw-`) and the private API
(`<stage>-apigw-private-`). Each uses the API's `prod` stage metrics.

| Alarm | Measures | Fires when | Severity |
|---|---|---|---|
| `5xx-error-rate` | `5XXError` average over 1 minute | Above 1% for 5 consecutive minutes | Critical |
| `4xx-error-rate` | Public: `4XXError` average. Private: the share of requests answered 401 or 403 | Above 5% for 5 consecutive minutes | Warning |
| `e2e-p95-latency` | `Latency` p95 over 5 minutes, or `0` below 40 requests | Above 3000 ms in 2 of 3 periods | Warning |
| `integration-p95-latency` | `IntegrationLatency` p95 over 5 minutes, or `0` below 40 requests | Above 2900 ms in 2 of 3 periods | Warning |

`Latency` is the whole time API Gateway took. `IntegrationLatency` is the time the backend, the
Lambda function, took. When the integration latency rises and the gap between the two stays flat,
the delay is behind API Gateway. The private API's 401/403 rate comes from a metric filter on its
access log group, published as `Flex/ApiGateway` `<stage>-apigw-private-auth-failures`.

### WAF

`WafAlarms`
([`waf.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/constructs/alarms/waf.ts))
covers both web ACLs: the CloudFront web ACL (`<stage>-cloudfront-waf-`, `us-east-1`) and the
regional web ACL on the public API (`<stage>-api-waf-`, `eu-west-2`). All metrics are 5 minute
sums.

| Alarm | Measures | Fires when | Severity |
|---|---|---|---|
| `managed-rules-blocked-requests-v2` | `BlockedRequests` from the AWS managed rule groups | Above 0 in one period | Critical |
| `blocking-90-percent-requests-v2` | Blocked as a share of blocked plus allowed | Above 90% in one period | Critical |
| `blocked-requests-spike-anomaly-v2` | `BlockedRequests` against an anomaly detection band of 2 standard deviations | Above the band in 2 of 3 periods | Warning |

On the CloudFront web ACL the managed rules alarm sums the four managed rule groups. On the API web
ACL it uses the `ALL` rule metric, so it counts every blocked request. The API web ACL blocks by
default and allows only requests that carry the CloudFront origin secret, so a request sent
straight to API Gateway also fires it.

### CloudFront

`CloudFrontAlarms`
([`cloudfront.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/constructs/alarms/cloudfront.ts))
uses the distribution's rate metrics, which are already percentages. The distribution publishes
additional metrics, which `TotalErrorRate` needs.

| Alarm | Measures | Fires when | Severity |
|---|---|---|---|
| `5xx-error-rate` | `5xxErrorRate` average over 1 minute | Above 1% for 5 consecutive minutes | Critical |
| `4xx-error-rate` | `4xxErrorRate` average over 1 minute | Above 5% for 5 consecutive minutes | Warning |
| `total-error-rate` | `TotalErrorRate` average over 1 minute | Above 5% for 5 consecutive minutes | Warning |

### CloudFront Functions

`CloudFrontFunctionAlarms`
([`cloudfront-function.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/constructs/alarms/cloudfront-function.ts))
covers both viewer request functions, `<stage>-cff-platform-` and `<stage>-cff-docs-`. See
[CloudFront Functions](/flex/edge/cloudfront-functions/) for what they do. All metrics are 1 minute
sums.

| Alarm | Measures | Fires when | Severity |
|---|---|---|---|
| `function-execution-errors` | `FunctionExecutionErrors` | Above 0 for 5 consecutive minutes | Critical |
| `function-throttles` | `FunctionThrottles`, the function exceeding its compute limit | Above 0 for 5 consecutive minutes | Critical |
| `function-validation-errors` | `FunctionValidationErrors`, a malformed event returned to CloudFront | Above 0 for 2 consecutive minutes | Warning |

The `function-throttles` description says "Warning", but the alarm publishes to the critical topic.

### Shield Advanced

`ShieldAlarms`
([`shield.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/constructs/alarms/shield.ts))
exists only in staging and production, because the global stack creates the Shield protection only
outside the development environment.

| Alarm | Measures | Fires when | Severity |
|---|---|---|---|
| `ddos-detected` | `DDoSDetected` maximum over 1 minute | Above 0 | Critical |
| `ddos-attack-requests-per-second` | `DDoSAttackRequestsPerSecond` maximum over 1 minute | Above 0 | Warning |

### Smoke test

| Alarm | Measures | Fires when | Severity |
|---|---|---|---|
| `<stage>-smoke-test-no-success` | `Flex/SmokeTest` `SmokeTestSuccess` sum over 15 minutes, dimension `Environment` | Below 1. Missing data counts as breaching | None: no action |

This alarm has no alarm action, so it never posts to Slack. Check it by hand. See
[The smoke test](#the-smoke-test).

### Alarm relay health

`createAlarmRelay`
([`alarm-relay.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/constructs/alarms/alarm-relay.ts))
creates three alarms for each relay, named `<stage>-flex-alarm-relay-<critical|warning>-<type>`.
Each uses a 5 minute period and fires above 0.

| Alarm | Measures | Meaning |
|---|---|---|
| `errors` | Relay Lambda `Errors`, sum | A forward attempt failed. Lambda retries twice. |
| `failure-queue-not-empty` | Failure queue `ApproximateNumberOfMessagesVisible`, maximum | The relay gave up on a notification. It is in the failure queue and can be replayed. |
| `failure-queue-undelivered` | Relay Lambda `DestinationDeliveryFailures`, sum | The relay gave up and the failure queue rejected the notification. It is lost. |

These alarms do not go through the relay. They publish to their own topic,
`<stage>-flex-alerts-relay-health` in `us-east-1`, encrypted with its own key
`alias/<stage>-flex-alerts-relay-health-key`, so a broken relay cannot silence them.

:::caution[No subscribers]
The relay health topic is created without subscribers. Until one is added, these alarms change
state in CloudWatch and notify nobody. Check them when edge alerts seem to be missing.
:::

The response is in [Alarm relay failures](/flex/runbooks/alarm-relay-failures/).

## The alarm relay

CloudFront, CloudFront Functions, the CloudFront web ACL and Shield publish metrics only in
`us-east-1`, so their alarms must live there, in the global stack. A CloudWatch alarm can only
notify an SNS topic in its own region, and the alerting topics are in `eu-west-2`. The relay
bridges the two.

The global stack builds one relay per severity:

| Resource | Name |
|---|---|
| Relay topic | Generated name, encrypted with `alias/<stage>-flex-alerts-relay-key` |
| Relay Lambda | Generated name. Its logical id in the stack starts `CriticalRelayFn` or `WarningRelayFn` |
| Failure queue | `<stage>-flex-alarm-relay-<severity>-failures`, kept 14 days |

The edge alarms publish to the relay topic. The relay Lambda, subscribed to it, republishes each
notification's subject, cut to 100 characters, and message to the matching `eu-west-2` alerting
topic, whose ARN it holds in `TARGET_TOPIC_ARN`. SNS invokes the Lambda asynchronously, so a failed
invocation is retried twice and then sent to the failure queue.

## The smoke test

The smoke test stack (`<env>-FlexSmokeTest`) exists only in the persistent environments. An
EventBridge rule runs the smoke test Lambda every 5 minutes. The handler, in
[`platform/smoke-test`](https://github.com/govuk-once/flex/blob/main/platform/smoke-test/src/handler.ts),
signs in, calls `GET /app/udp/v1/users/me` through CloudFront, and writes `SmokeTestSuccess` to the
`Flex/SmokeTest` namespace: `1` for a 2xx response, `0` for anything else.

How it gets a token differs by environment:

| Environment | Access token | App Check token |
|---|---|---|
| `development` | Stub token generator | Yes |
| `staging` | GOV.UK One Login | No |
| `production` | GOV.UK One Login | Yes |

So staging cannot prove an App Check change works. Only production can.

The alarm fires when no run succeeded in a 15 minute period, which is about three failed runs in a
row. A run that never writes its metric also counts as a failure.

A passing smoke test proves one public, authenticated route works from CloudFront to UDP. It does not
prove other domains, private routes, service gateways other than UDP, or write endpoints work.

`GET /health` on the public API is a mock integration that always returns 200. It exists because a
REST API needs at least one method to deploy. It proves nothing about health.

## Dashboards

The dashboards stack (`<env>-FlexCloudWatchDashboards`) exists only in the persistent environments.
It deploys two CloudWatch dashboards from JSON in
[`platform/infra/flex/src/dashboards`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/dashboards):

| Dashboard | Shows |
|---|---|
| `<env>-flex-driving-dashboard` | For each DVLA route and the UDP identity routes on the public API: requests split into success, 4xx and 5xx, and latency percentiles. A net linked users graph. Requests, latency and integration latency for the DVLA service gateway on the private API. |
| `<env>-flex-udp-dashboard` | The same for the UDP routes on the public API and the UDP service gateway on the private API. |

The widgets use per-method API Gateway metrics, which the APIs publish because detailed metrics are
on. To add a dashboard, add its JSON to the directory and a `CfnDashboard` to
[`cloudwatch-dashboards.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/stacks/cloudwatch-dashboards.ts).

## Adding or changing an alarm

- Lambda alarms come with the function constructs. Change the defaults in `lambda.ts`, and turn them
  off for one function with `enableDefaultAlarms: false` only when something else covers it.
- Every other alarm is created where its resource is created: the platform stack for the APIs and
  the API web ACL, the global stack for the edge, the smoke test stack for the smoke test.
- Pass the alarm the stack's `criticalAction` or `warningAction`. Stacks in `eu-west-2` build them
  with `importAlarmActions` from the topic ARNs the core stack exports to
  `/<env>/flex/topic/critical-alarms` and `/<env>/flex/topic/warning-alarms`. The global stack gets
  them from its relays instead.
- Start the description with `Critical:` or `Warning:` to match the action, so the Slack message
  shows the severity.
