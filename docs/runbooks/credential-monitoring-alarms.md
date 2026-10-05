# Credential Monitoring Alarms

Use this runbook to respond to a credential monitoring alarm: a secret overdue for rotation, a rotation status that cannot be determined, Cognito configuration drift, a failed secret rotation, or a certificate close to expiry.

Alternatively, go to the [Runbooks](/docs/runbooks/README.md) page to find available runbooks.

## Scope

Covers the alarms created by the `FlexCredentialMonitor` stack, the secret rotation alerts in `FlexCore`, and the certificate expiry alarm in `FlexGlobal`.

The credential monitor runs only in the persistent environments (development, staging and production). Personal and PR stages are not monitored, although every stage has its own certificate expiry alarm.

---

## Prerequisites

- Read-only role must be assumed for the target team and environment via the GDS CLI, see [Environment Setup Guide](/docs/environment-setup.md#aws-configuration-using-gds-cli).
- Region is `eu-west-2`, except for the certificate alarm, which is in `us-east-1`.
- Access to the target environment's alerting Slack channel.

Set the stage to ensure all commands are run against the correct stage:

```bash
export STAGE=<development|staging|production>
```

---

## What Each Alarm Measures

The credential monitor Lambda runs every hour. It publishes counts to the `Flex/Credentials` namespace with an `Environment` dimension, and logs the credentials behind each count.

| Alarm                                                      | Fires when                                                                                               | Severity |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| `${STAGE}-credential-monitor-secret-rotation-overdue`      | A credential is more than 7 days past its rotation date or its maximum age                               | Warning  |
| `${STAGE}-credential-monitor-secret-rotation-unverifiable` | The monitor could not determine a credential's rotation status (missing secret, access denied, no dates) | Warning  |
| `${STAGE}-credential-monitor-cognito-config-drift`         | The Cognito user pool or client ID in SSM differs from the value the deployed authorizer is running with | Critical |
| `${STAGE}-credential-monitor-not-reporting`                | No successful monitor run in at least 3 of the last 4 hours                                              | Warning  |
| `${STAGE}-credential-monitor-failing`                      | The monitor Lambda failed in each of the last 3 hours                                                    | Warning  |
| `${STAGE}-dvla-secret-rotation-failed`                     | The DVLA secret rotation Lambda returned an error                                                        | Critical |
| `${STAGE}-secret-rotation-alert-undelivered`               | A rotation failure alert could not be published to the critical topic and is in the dead-letter queue    | Warning  |
| `${STAGE}-secret-rotation-alert-lost`                      | A rotation failure alert could not be published to the critical topic or to the dead-letter queue        | Warning  |
| `${STAGE}-certificate-days-to-expiry`                      | The CloudFront certificate expires in under 30 days                                                      | Critical |

Alongside these alarms, an EventBridge rule posts a message to the critical channel for every Secrets Manager `RotationFailed` or `TestRotationFailed` event. Secrets Manager retries a failed rotation, so this message can repeat for one failure.

### What counts as overdue

- **Automatically rotated secrets**: every secret in the account with rotation enabled, excluding replicas of secrets whose primary is in another region. The due date is the earlier of the scheduled next rotation and the last rotation plus 90 days, so a schedule longer than the policy also counts.
- **Required credentials**: DVLA, UDP and UNS consumer configurations, the smoke test user, and the E2E test user (the E2E private JWK in development). Each must have a current version younger than 90 days, whether or not rotation is enabled, so disabling rotation does not remove a credential from monitoring.

A 7-day grace period applies to both.

---

## Responding

### 1. Find the credentials behind the alarm

Find the monitor's log group:

```bash
aws logs describe-log-groups \
  --query "logGroups[?contains(logGroupName, 'CredentialMonitor')].logGroupName" \
  --output text
```

Query the latest findings in CloudWatch Logs Insights against that log group:

```
fields @timestamp, message, overdue, unverifiable, drifted
| filter level = "WARN"
| sort @timestamp desc
| limit 20
```

Overdue entries have a `resourceName` and a `dueDate`. Unverifiable entries have a `resourceName` and a `reason`, such as `ResourceNotFoundException` or `AccessDeniedException`.

### 2. Act on the finding

| Alarm                    | Action                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotation overdue         | Rotate the credential following [Leaked Secret](/docs/runbooks/leaked-secret.md#rotating-and-redeploying-affected-services). For an automatically rotated secret, first check why rotation stopped (failed rotation, schedule changed). |
| Rotation unverifiable    | Confirm the secret exists and that its ARN in `flex-params` is correct. An access error usually means the secret moved or its resource policy changed.                                                                                  |
| Cognito config drift     | The Platform team has changed the user pool or client in `flex-params`. Deploy the platform stack so the authorizer picks up the new values, and confirm the change with the Platform team.                                             |
| Not reporting or failing | Read the monitor's errors in its log group. A configuration error (missing SSM parameter, permission) fails every run.                                                                                                                  |
| DVLA rotation failed     | Read the rotation Lambda's logs. The secret keeps its current value. Check the secret's rotation status in Secrets Manager before retrying.                                                                                             |
| Alert undelivered        | Read the message in the dead-letter queue, see [Reading the dead-letter queue](#reading-the-dead-letter-queue). It holds the rotation failure that was not delivered, and the reason delivery failed.                                   |
| Alert lost               | Nothing was kept. Find the failure in CloudTrail (`RotationFailed` or `TestRotationFailed` from `secretsmanager.amazonaws.com`), then check the `alias/${STAGE}-flex-secret-rotation-alert-dlq-key` key and the queue's policy.         |
| Certificate expiry       | ACM renews at 45 days before expiry. Check the certificate's renewal status in ACM (`us-east-1`) and that its DNS validation records still exist in the hosted zone.                                                                    |

### Reading the dead-letter queue

The queue's name is generated. Find it from the `FlexCore` stack, then read its messages:

```bash
export DLQ_URL=$(aws cloudformation list-stack-resources \
  --stack-name "${STAGE}-FlexCore" \
  --query "StackResourceSummaries[?ResourceType=='AWS::SQS::Queue' && starts_with(LogicalResourceId, 'SecretRotationAlertDeadLetterQueue')].PhysicalResourceId" \
  --output text)

aws sqs receive-message \
  --queue-url "$DLQ_URL" \
  --max-number-of-messages 10 \
  --message-attribute-names All \
  --visibility-timeout 30
```

Reading needs `kms:Decrypt` on the `alias/${STAGE}-flex-secret-rotation-alert-dlq-key` key, which the AWS managed read-only policy does not grant. The `ERROR_CODE` and `ERROR_MESSAGE` message attributes give the reason delivery failed.

---

## Known Limitations

- **The `RotationFailed` message needs CloudTrail.** EventBridge only receives Secrets Manager rotation events when a CloudTrail trail with logging is enabled in the account. Nothing in this repository creates one. Confirm a trail exists in each account before relying on the message:

  ```bash
  aws cloudtrail describe-trails --include-shadow-trails
  aws cloudtrail get-trail-status --name <trail-arn>
  ```

  The `dvla-secret-rotation-failed` alarm does not depend on CloudTrail and covers DVLA rotation failures either way.

- **Undelivered alerts are kept, not announced, when the alarm topic key fails.** The dead-letter queue has its own KMS key, so an alert that fails because of the alarm topic key is still stored. The `undelivered` and `lost` alarms notify through the warning topic, which uses the alarm topic key, so in that case they change state in CloudWatch without a Slack message.

- **First deployment.** The not-reporting alarm fills missing hours with zero. Until the monitor has published its first result, the alarm's behaviour depends on how CloudWatch evaluates a metric with no data at all. Check its state history after the first deployment to each environment.

- **Overdue on first run.** Credentials that have not been rotated within the last 97 days raise the overdue alarm on the monitor's first run. That is accurate under the policy.

---

## Related

- [Leaked Secret](/docs/runbooks/leaked-secret.md)
- [Lambda Errors or Throttling Alarm](/docs/runbooks/lambda-errors-throttling-alarm.md)
