# Verify Environment Health

Use this runbook to confirm an environment is healthy or identify the root cause when it is not.

## Scope

This runbook should be used for any of the following scenarios:

- Confirm the environment remains healthy after a recent successful deployment.
- A deployment has failed and needs investigating.
- A potential misconfiguration has been identified and needs investigating.

> Personal and PR stacks do not have their own smoke tests or dedicated Slack channels. Alerts for these stacks still trigger and are posted into the `govuk-once-flex-alerting-dev` Slack channel.

Alternatively, go to the [Runbooks](/docs/runbooks/README.md) page to find available runbooks.

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

## Quick Check

### 1. Review "Smoke Test" alarm state

```bash
aws cloudwatch describe-alarms \
  --alarm-names "${STAGE}-smoke-test-no-success" \
  --query "MetricAlarms[0].{State:StateValue,Since:StateUpdatedTimestamp}" \
  --output table \
  --region eu-west-2
```

| Alarm State | Meaning                                                                                                                              | Action                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `OK`        | Successful test result within the last 15 minutes                                                                                    | Continue to next step           |
| `ALARM`     | Unsuccessful test result within the last 15 minutes. Could be an issue with the path under test or the smoke test being unresponsive | Go to [Smoke Test](#smoke-test) |

> **Smoke test alarm must be checked manually**: The smoke test alarm does not post to any Slack channels so you must verify the alarm state manually, see [Smoke Test](#smoke-test).

### 2. Review alarms activity

```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix "${STAGE}-" \
  --state-value ALARM \
  --query "MetricAlarms[].{Alarm:AlarmName,Since:StateUpdatedTimestamp}" \
  --output table \
  --region eu-west-2
```

### 3. Review recent Slack channel activity

Warning and critical alarms both notify the same channel for each environment. The alarm severity is mentioned in the alerting message itself. All Slack channels use AWS Chatbot, so you can also query CloudWatch via Amazon Q within the channel given it has read-only access.

You can navigate to the CloudWatch Logs console by clicking the link provided in the message title, or use the Amazon Q chatbot to search for the logs instead.

### Outcome

An `OK` smoke test with no alarms firing is a good indicator that the environment is "healthy". You can stop here and record your findings, or continue with the remaining verification checks if necessary.

---

## Common Scenarios

Common scenarios you may encounter when verifying environment health. If you already have a scenario in mind, use the table below to navigate to the relevant section(s).

| Scenario                                                                | Likely cause                                                                                                                         | Next steps                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Smoke test: Alarm firing                                                | The path under test is broken, or the smoke test itself is failing. A credential or configuration fault in the test is not an outage | Go to [Smoke Test](#smoke-test)                                                                                |
| Smoke test: Alarm firing, no Slack notification                         | Expected behaviour. The alarm does not post into any Slack channels, so it must be checked manually                                  | Go to [Smoke Test](#smoke-test)                                                                                |
| Smoke test: State is `OK`, but a domain error was reported              | A path the smoke test does not cover, such as another domain, a private gateway or a write endpoint                                  | Go to [Dependencies](#dependencies)                                                                            |
| Latency mismatch: Integration p95 high, API Gateway stable              | Most likely the delay is downstream of Flex, a dependency rather than a platform issue                                               | Go to [External Service Outage](/docs/runbooks/external-service-outage.md)                                     |
| Increase in `flex-fetch retrying request` logs, no alarms fired         | Potential issue with a dependency. Early warning signs before a threshold is breached                                                | Go to [Dependencies](#dependencies), then [External Service Outage](/docs/runbooks/external-service-outage.md) |
| `Gateway response schema validation failed`, or 502s against one target | Contract drift, the provider changed its response shape and needs rectifying                                                         | Go to [Fix Forward](/docs/runbooks/fix-forward.md)                                                             |
| Increase in 403 responses from UDP/UNS                                  | Cross-account role or trust policy fault on the Flex side, not a dependency outage                                                   | Go to [Fix Forward](/docs/runbooks/fix-forward.md)                                                             |
| Alarms in `INSUFFICIENT_DATA` across a domain                           | Possible routing or upstream issue, given the function invocations are lower than expected                                           | Go to [Alarms](#alarms), then [Dependencies](#dependencies)                                                    |
| Stack status: `UPDATE_ROLLBACK_COMPLETE` or `UPDATE_FAILED`             | A deployment failed, so the change is not live                                                                                       | Go to [Stacks](#stacks), then [Promoting a Change Through the Pipeline](/docs/runbooks/pipeline-promotion.md)  |
| No alarms fired, but users are reporting issues                         | Possible issue with a dependency, might be unmonitored and/or not covered by an alarm                                                | Go to [Dependencies](#dependencies); also look to raise a new alarm coverage ticket if necessary               |

---

## What Should I Check?

1. **Smoke Test**: Is the path under test working as expected?
2. **Alarms**: Have any thresholds been breached?
3. **Stacks**: Did the most recent deployment apply its changes cleanly?
4. **Dependencies**: Do all of the uncovered paths work as expected?

Each check can be read in order starting with the strongest signal first, stopping once you identify the root cause.

**No single check means "healthy".** A passing smoke test, no active alarms and clean stack deployments combined provide confidence, you can't rely on a single check to confirm an environment is healthy.

### Smoke Test

This test proves a real endpoint (UDP `GET /v1/users/me`) with authentication via a public API Gateway works end-to-end. What this does not prove is verifying all domains (E.g. `dvla`, `uns`, etc), endpoints, private gateways and other endpoints work as intended, so this check cannot be trusted as the single source of truth to verify an environment's health and must be used alongside other checks to provide confidence.

The smoke test runs every five minutes but the alarm operates within a 15 minute window. An alarm will only fire when 3 consecutive failures occur, so reading the recent history instead of a single alarm state is recommended for full visibility.

```bash
aws cloudwatch get-metric-statistics \
  --namespace Flex/SmokeTest \
  --metric-name SmokeTestSuccess \
  --dimensions Name=Environment,Value=${STAGE} \
  --start-time "$(date -u -v-2H +%FT%TZ)" \
  --end-time "$(date -u +%FT%TZ)" \
  --period 300 \
  --statistics Sum \
  --output table \
  --region eu-west-2
```

A steady stream of `1.0` datapoints is healthy. A gap or a `0.0` is considered a failure and it is recommended you look into the Lambda logs to find the cause. Look up the Lambda in the `${STAGE}-FlexSmokeTest` stack resources.

Issues related to credentials or misconfiguration in the test suite are not an outage, confirm this is the case before escalating.

> `GET /health` on the public API is a mock integration that always returns `200`. It exists only because API Gateway requires at least one deployed method so this endpoint should never be used to verify environment health.

### Alarms

This check verifies there are no active alarms currently breaching. The list of available alarms are listed below:

| Alarm Name                                        | Description                       |
| ------------------------------------------------- | --------------------------------- |
| `${STAGE}-smoke-test-no-success`                  | Smoke Test alarm                  |
| `${STAGE}-apigw-*`, `${STAGE}-apigw-private-*`    | API Gateway alarms                |
| `${STAGE}-<function-name>-alarm-*`                | Lambda alarms                     |
| `${STAGE}-cloudfront-*`                           | CloudFront alarms                 |
| `${STAGE}-cff-*`                                  | CloudFront Functions alarms       |
| `${STAGE}-api-waf-*`, `${STAGE}-cloudfront-waf-*` | API Gateway/CloudFront WAF alarms |
| `${STAGE}-shield-*`                               | Shield Advanced alarms            |

Thresholds are defined in the [alarm constructs](/platform/infra/flex/src/constructs/alarms).

To view the thresholds for an alarm, run:

```bash
aws cloudwatch describe-alarms \
  --alarm-names "<alarm-name>" \
  --query "MetricAlarms[0].{Metric:MetricName,Threshold:Threshold,Comparison:ComparisonOperator,Period:Period,Datapoints:DatapointsToAlarm,EvaluationPeriods:EvaluationPeriods}" \
  --output table \
  --region eu-west-2
```

> Edge alarms (`cloudfront`, `cff`, `waf`, `shield`) are located in `us-east-1`, to view those alarms you can run the same command but specify the `--region us-east-1` flag instead.

### Stacks

This check verifies the infrastructure matches the last successfully applied deployment. CloudFormation only knows the deploy was successfully applied, it cannot verify code execution.

An environment can pass the checks above and still hold a partial deploy: `cdk deploy --all` can apply several stacks but still fail on one resulting in a mixed state.

```bash
# List all stacks in `eu-west-2`
aws cloudformation list-stacks \
  --query "StackSummaries[?StackStatus!='DELETE_COMPLETE' && starts_with(StackName, '${STAGE}')].{Name:StackName,Status:StackStatus}" \
  --output table \
  --region eu-west-2

# List all stacks in `us-east-1` (E.g. FlexGlobal)
aws cloudformation list-stacks \
  --query "StackSummaries[?StackStatus!='DELETE_COMPLETE' && starts_with(StackName, '${STAGE}')].{Name:StackName,Status:StackStatus}" \
  --output table \
  --region us-east-1
```

A full deploy creates:

- `${env}-FlexCore`, `${env}-FlexSmokeTest` and `${env}-FlexParams` (persistent environments only)
- `${stage}-FlexPlatform`, `${stage}-FlexGlobal` (`us-east-1`)
- One `${stage}-<domain>` per deployed domain
- `${stage}-FlexApiDeployment`

Which domains are deployed varies by environment, see [Environment Differences](#environment-differences).

> `env` refers to the persistent environment (`development`, `staging`, `production`), whereas `stage` is the deployment name, which for personal and PR stacks differs from the environment.

| Status                     | Description                                          | Action                                                                                                    |
| -------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `*_COMPLETE`               | Deployment completed successfully                    | Healthy                                                                                                   |
| `UPDATE_ROLLBACK_COMPLETE` | Deployment failed and was successfully reverted      | Check the deploy run, then fix forward                                                                    |
| `UPDATE_FAILED`            | Deployment failed without completing the rollback    | Read the stack events, then fix forward                                                                   |
| `UPDATE_ROLLBACK_FAILED`   | The deployment rollback failed, stack in a bad state | Escalate, requires admin access                                                                           |
| `*_IN_PROGRESS`            | Deployment currently in-flight                       | Compare against GitHub Actions. Wait for the deploy to complete before starting a new deploy or retrying. |

For a stack in an incomplete or failed state, you can identify the failing resource by running the following command:

```bash
aws cloudformation describe-stack-events \
  --stack-name ${STAGE}-FlexPlatform \
  --max-items 20 \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED'].{Resource:LogicalResourceId,Reason:ResourceStatusReason}" \
  --output table \
  --region eu-west-2
```

No output means no failed resources, which is the healthy result. Swap the stack name for any other stack from the list above.

Alternatively, you can view the stack events and status in the CloudFormation console.

> `${STAGE}-FlexGlobal` is located in `us-east-1`, to view the events for this stack you can run the same command but specify the `--region us-east-1` flag instead.

### Dependencies

This check verifies a path that the smoke test does not cover, determining whether or not the dependency works as expected.

You should only reach for this check after all of the previous checks are clean but you still suspect there is a deeper issue that none of the previous checks can cover. If you detect an issue during this check, this would be a good time to escalate to the owning team and also follow up with the [External Service Outage Runbook](/docs/runbooks/external-service-outage.md).

You can view the X-Ray service map by navigating to the X-Ray console and selecting the `Service map` tab. All Flex Lambdas trace, so you can find additional details around errors, throttles and latency which can highlight a failing downstream service.

You can also search the affected domain's log group in CloudWatch Logs Insights for common search terms:

| Search term                                 | Description                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `flex-fetch retrying request`               | Multiple retry attempts may indicate an issue with the downstream dependency                                                                 |
| `flex-fetch failed`                         | The call failed after reaching the maximum retry attempts. The `url` field identifies the dependency                                         |
| `Gateway response schema validation failed` | Successful response that contains an incorrect body shape against the expected schema. Investigate the contract drift, this is not an outage |

> The source code containing these search terms can be found in `libs/sdk/src/fetch/fetch.ts` and `libs/service-gateway/src/handler/index.ts`.

It is recommended to use the E2E suites given the configuration is already in place, you only need to assume read-only credentials which you'll have done already in the [Prerequisites](#prerequisites).

To verify Flex platform code (e.g. private API Gateway, CloudFront authentication), run:

```bash
CI=1 STAGE=<development|staging|production> pnpm --filter @flex/e2e test:e2e:platform
```

> Make sure your `tests/e2e/.env` doesn't include environment variables that may conflict with the environment you want to run the tests against

To verify Flex domain code, run:

```bash
# replace <DOMAIN> with the domain name (e.g. @flex/uns-domain, @flex/dvla-domain, etc.)
CI=1 STAGE=<development|staging|production> pnpm --filter @flex/<DOMAIN> test:e2e
```

NOTE: Domain E2E tests perform write operations, so consider the impact prior to running these against your desired environment.

> Comparing results across different stages should help you identify the root cause. A fault that can be reproduced across multiple stages leads to an issue with a shared external dependency, whereas a fault in a single stage most likely points to misconfiguration in that stage.

---

## Environment Differences

There are some checks where each environment's results can differ:

| Feature                          | `development`             | `staging`               | `production`          |
| -------------------------------- | ------------------------- | ----------------------- | --------------------- |
| Smoke test: Authentication       | Uses stub token generator | Uses Real One Login     | Uses Real One Login   |
| Smoke test: App Check            | Yes                       | No                      | Yes                   |
| Post-deployment: Automated check | Runs Platform E2E tests   | Runs Platform E2E tests | Manual check required |

- Do not validate an App Check change in `staging`. The `production` environment is the only one that can verify App Check, given `staging` skips this step.
- The `production` environment has no automated post-deploy verification. A clean deployment verifies the CloudFormation stacks were applied successfully, so a manual check is needed.

---

## Resolve or Escalate

Escalate to the `govuk-once-flex-developers` team if any of the following applies:

- A stack is stuck in `UPDATE_ROLLBACK_FAILED` that requires admin access to resolve.
- Impact is affecting the production environment and needs immediate attention that is proving difficult to resolve by the steps outlined in this runbook.
- Finding the root cause is becoming time-consuming while impact continues.
- The issue(s) sit outside of Flex's control and requires more attention than what is provided by this runbook.
  - For UNS/UDP-related issues, you can reach out to the owning team directly for more guidance. The [External Service Outage Runbook](/docs/runbooks/external-service-outage.md) provides more detail.

All other issues should be resolvable either by following the steps outlined in this runbook or another runbook linked from this one that may provide more context.

---

## Reference

**Alarms & Notifications:**

- [`platform/infra/flex/src/constructs/alarms/*`](/platform/infra/flex/src/constructs/alarms/)
- [`platform/infra/flex/src/stacks/core/notifications.ts`](/platform/infra/flex/src/stacks/core/notifications.ts)

**Stacks:**

- [`platform/infra/flex/src/app.ts`](/platform/infra/flex/src/app.ts)

**Smoke Test:**

- [`platform/smoke-test`](/platform/smoke-test): Smoke test workspace
- [`platform/infra/flex/src/stacks/smoke-test.ts`](/platform/infra/flex/src/stacks/smoke-test.ts): Smoke test stack configuring the scheduler and alarm

**E2E:**

- [`tests/e2e`](/tests/e2e/README.md)
- [`domains/dvla/e2e/dvla.test.ts`](/domains/dvla/e2e/dvla.test.ts)
- [`domains/udp/e2e/udp.test.ts`](/domains/udp/e2e/udp.test.ts)
- [`domains/uns/e2e/uns.test.ts`](/domains/uns/e2e/uns.test.ts)

---

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
- [Release Notifications and Alerting](/docs/release-notifications.md)
