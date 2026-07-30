# Lambda Errors or Throttling Alarm

Use this runbook to investigate and respond to a Lambda error rate or throttles
alarm on the AWS FLEX platform.

## Scope

Covers all FLEX Lambda functions, not just the ones behind API Gateway. It does not cover API Gateway 5xx errors caused by a handler as a returned 500/502 is a successful invocation from Lambda's perspective.

> Personal and PR stacks are also included given the same alarms and thresholds apply for all environments, they will route to `govuk-once-flex-alerting-dev`.

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

## What Each Alarm Measures

<!-- TODO: error-rate, throttles, duration alarms - example outputs from slack and deployed env -->

---

## Steps

1. **Confirm the alarm and its state:**

```bash
   aws cloudwatch describe-alarms \
     --alarm-names "${STAGE}-<function>-alarm-error-rate" "${STAGE}-<function>-alarm-throttles" "${STAGE}-<function>-alarm-duration" \
     --query "MetricAlarms[].{Name:AlarmName,State:StateValue,Since:StateUpdatedTimestamp}" \
     --output table \
     --region eu-west-2
```

Confirm the alarms exist before assuming whether they'd fired or not.

2. **Verify invocation failure:** FLEX handlers return an HTTP error response and is considered a successful invocation. A firing alarm means something failed before or outside the catch, examples include:

- Import failure
- Middy resource failed to resolve (e.g., Secrets Manager/SSM)
- Unhandled rejection
- Timeout

3. **Check the logs** (CloudWatch Logs Insights, log groups):

<!-- TODO: table for common search terms to look for and why -->

4. **Check the metrics**

<!-- TODO: metrics to group for better visibility -->

---

## Resolve or Mitigate

| Cause                       | Response                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Timeout                     | Consider changing the route timeout or identify the downstream service causing the issue and fix forward   |
| Resource resolution failure | Identify the misconfigured reference and fix forward                                                       |
| Unhandled exception         | Check `#govuk-once-flex-release` for the deployment around the time of failure, identify and fix the issue |
| Throttling                  | Likely caused by concurrency limits, identify the function causing this                                    |

Escalate to `govuk-once-flex-developers` when:

- The root cause sits at the account level and requires admin access.
- The root cause can't be identified, or cannot be resolved following the steps above while impacting the production environment.

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
