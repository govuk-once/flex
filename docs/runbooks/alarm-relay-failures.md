# Alarm Relay Failure

Use this runbook when an alarm relay health alarm has fired, to find the notifications that were not forwarded and replay them.

Alternatively, go to the [Runbooks](/docs/runbooks/README.md) page to find available runbooks.

## Scope

Edge resources (CloudFront, CloudFront Functions, WAF, Shield, the ACM certificate) live in `us-east-1`. Their alarms publish to a relay topic in `us-east-1`, and a relay Lambda forwards each notification to the alerting topics in `eu-west-2`. There is one relay per severity: critical and warning.

This runbook covers the relay itself failing. It does not cover the alarms being relayed.

---

## Prerequisites

- Read-only role must be assumed for the target team and environment via the GDS CLI, see [Environment Setup Guide](/docs/environment-setup.md#aws-configuration-using-gds-cli).
- Replaying a notification publishes to SNS and deletes from SQS, which needs a role with write access.
- Region is `us-east-1` for the relay and `eu-west-2` for the alerting topics.

Set the stage and severity to ensure all commands are run against the correct relay:

```bash
export STAGE=<development|staging|production>
export SEVERITY=<critical|warning>
```

---

## What Each Alarm Measures

Names are `${STAGE}-flex-alarm-relay-${SEVERITY}-<type>`. All three use a 5 minute window, fire above zero and treat missing data as not breaching.

| Alarm                       | Metric                                               | Meaning                                                                                |
| --------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `errors`                    | Lambda `Errors`, `Sum`                               | A forward attempt failed. Lambda retries twice before giving up                        |
| `failure-queue-not-empty`   | SQS `ApproximateNumberOfMessagesVisible`, `Maximum`  | The relay gave up on a notification. It is in the failure queue and can be replayed    |
| `failure-queue-undelivered` | Lambda `DestinationDeliveryFailures`, `Sum`          | The relay gave up and the failure queue rejected the notification. It cannot be replayed |

These alarms do not go through the relay. They publish to `${STAGE}-flex-alerts-relay-health` in `us-east-1`, which has its own KMS key, so a broken relay cannot silence them.

> The health topic is created without subscribers. Until one is added for the environment, the alarms change state in CloudWatch but nobody is notified.

---

## 1. Confirm Which Alarms Are Firing

```bash
aws cloudwatch describe-alarms \
  --region us-east-1 \
  --alarm-name-prefix "${STAGE}-flex-alarm-relay-" \
  --query 'MetricAlarms[].[AlarmName,StateValue,StateUpdatedTimestamp]' \
  --output table
```

## 2. Find the Cause

The relay function name is generated. Find it, then read its errors:

```bash
aws lambda list-functions \
  --region us-east-1 \
  --query 'Functions[?contains(FunctionName, `RelayFn`)].FunctionName'

aws logs tail "/aws/lambda/<function name>" --region us-east-1 --since 1h
```

| Error                                  | Likely cause                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `KMS.AccessDeniedException`            | The relay role lost access to the `eu-west-2` alarm topic key, or the key is disabled |
| `AuthorizationError` on `sns:Publish`  | The relay role lost permission to publish to the target topic                        |
| `NotFound`                             | The target topic was replaced and `TARGET_TOPIC_ARN` is stale. Redeploy the stack    |
| Timeout                                | SNS in `eu-west-2` is slow or unreachable, check the AWS Health Dashboard            |

Fix the cause before replaying, otherwise the replay fails the same way.

## 3. Inspect the Failed Notifications

```bash
export QUEUE_URL=$(aws sqs get-queue-url \
  --region us-east-1 \
  --queue-name "${STAGE}-flex-alarm-relay-${SEVERITY}-failures" \
  --query QueueUrl --output text)

aws sqs receive-message \
  --region us-east-1 \
  --queue-url "$QUEUE_URL" \
  --max-number-of-messages 10 \
  --visibility-timeout 300
```

Each message body is a Lambda failure record. The original notification is under `requestPayload.Records[].Sns`, and the error the relay returned is under `responsePayload`. Messages are kept for 14 days.

## 4. Replay

For each message, publish the original subject and message to the target topic, then delete the message from the queue:

```bash
export TARGET_TOPIC_ARN=$(aws ssm get-parameter \
  --region eu-west-2 \
  --name "/${STAGE}/flex/topic/${SEVERITY}-alarms" \
  --query Parameter.Value --output text)

aws sns publish \
  --region eu-west-2 \
  --topic-arn "$TARGET_TOPIC_ARN" \
  --subject "<requestPayload.Records[0].Sns.Subject>" \
  --message '<requestPayload.Records[0].Sns.Message>'

aws sqs delete-message \
  --region us-east-1 \
  --queue-url "$QUEUE_URL" \
  --receipt-handle "<ReceiptHandle>"
```

Many of the failed notifications will be stale by the time they are replayed. Check the current state of the underlying alarm first (step 1 with the alarm's own prefix) and only replay those that still matter. Delete the rest.

## 5. If `failure-queue-undelivered` Fired

The notification was not stored, so there is nothing to replay. List the edge alarms that changed state in the window and treat each as if it had just fired:

```bash
aws cloudwatch describe-alarm-history \
  --region us-east-1 \
  --history-item-type StateUpdate \
  --start-date "<ISO timestamp>" \
  --query 'AlarmHistoryItems[].[Timestamp,AlarmName,HistorySummary]' \
  --output table
```

Then check why the queue rejected the message. The usual cause is the relay role losing access to the queue or to the `alias/${STAGE}-flex-alerts-relay-health-key` key.
