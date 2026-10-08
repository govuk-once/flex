---
title: Alarm relay failures
description: Find edge alarm notifications the relay failed to forward, fix the relay and replay them.
---

Use this runbook when a `${STAGE}-flex-alarm-relay-` alarm is in `ALARM`, or when edge alerts
(CloudFront, CloudFront Functions, the CloudFront web ACL, Shield) seem to be missing from Slack.
It covers the relay failing, not the alarms it relays. Do the
[before you start](/flex/runbooks/overview/#before-you-start) steps first.

How the relay works and what its three health alarms mean is in
[The alarm relay](/flex/observability/alarms/#the-alarm-relay) and
[Alarm relay health](/flex/observability/alarms/#alarm-relay-health). The health alarms notify
nobody, so you will usually find them while checking alarms by hand.

The relay is in `us-east-1`. The alerting topics it forwards to are in `eu-west-2`. Replaying needs a
role with write access, because it publishes to SNS and deletes from SQS.

```bash
export SEVERITY=<critical|warning>
```

## Steps

1. **See which alarms are firing:**

   ```bash
   aws cloudwatch describe-alarms \
     --alarm-name-prefix "${STAGE}-flex-alarm-relay-" \
     --query "MetricAlarms[].{Name:AlarmName,State:StateValue,Since:StateUpdatedTimestamp}" \
     --output table \
     --region us-east-1
   ```

   `errors` alone means forwarding failed but may have succeeded on a retry.
   `failure-queue-not-empty` means notifications are waiting to be replayed.
   `failure-queue-undelivered` means some are lost: also do step 6.

2. **Find the cause in the relay's logs.** The function name is generated. Find it, then read its
   errors:

   ```bash
   aws cloudformation describe-stack-resources \
     --stack-name "${STAGE}-FlexGlobal" \
     --query "StackResources[?ResourceType=='AWS::Lambda::Function' && contains(LogicalResourceId, 'RelayFn')].{Relay:LogicalResourceId,Name:PhysicalResourceId}" \
     --output table \
     --region us-east-1

   aws logs tail "/aws/lambda/<function name>" --since 1h --region us-east-1
   ```

   | Error | Likely cause | Fix |
   |---|---|---|
   | `KMS.AccessDeniedException` | The relay role lost access to `alias/flex-alerts-key` in `eu-west-2`, or the key is disabled | Restore the key or the grant. Redeploy `${STAGE}-FlexGlobal`. |
   | `AuthorizationError` on `sns:Publish` | The relay role lost permission to publish to the alerting topic | Redeploy `${STAGE}-FlexGlobal`. |
   | `NotFound` | The alerting topic was replaced and the relay's `TARGET_TOPIC_ARN` is stale | Redeploy `${STAGE}-FlexGlobal`, which reads the ARN from SSM again. |
   | `Task timed out` | SNS in `eu-west-2` is slow or unreachable | Check the AWS Health Dashboard. |

   Fix the cause before replaying, or the replay fails the same way. See
   [Environments](/flex/delivery/environments/) for deploying one stack.

3. **Read the failed notifications:**

   ```bash
   export QUEUE_URL=$(aws sqs get-queue-url \
     --queue-name "${STAGE}-flex-alarm-relay-${SEVERITY}-failures" \
     --query QueueUrl --output text \
     --region us-east-1)

   aws sqs receive-message \
     --queue-url "$QUEUE_URL" \
     --max-number-of-messages 10 \
     --visibility-timeout 300 \
     --region us-east-1
   ```

   Each message body is a Lambda failure record. The original notification is under
   `requestPayload.Records[0].Sns`, with its `Subject` and `Message`. The relay's error is under
   `responsePayload`. Messages stay in the queue for 14 days.

4. **Decide what still matters.** Many notifications are stale by the time you replay them. For
   each one, check the current state of the alarm it names:

   ```bash
   aws cloudwatch describe-alarms \
     --alarm-names "<AlarmName from the Message>" \
     --query "MetricAlarms[0].{State:StateValue,Since:StateUpdatedTimestamp}" \
     --output table \
     --region us-east-1
   ```

5. **Replay or delete.** Get the alerting topic for the severity. It belongs to the environment, so
   for a personal or PR stage use `development`:

   ```bash
   export TARGET_TOPIC_ARN=$(aws ssm get-parameter \
     --name "/<development|staging|production>/flex/topic/${SEVERITY}-alarms" \
     --query Parameter.Value --output text \
     --region eu-west-2)
   ```

   For each notification that still matters, publish it, keeping the subject to 100 characters as
   the relay does:

   ```bash
   aws sns publish \
     --topic-arn "$TARGET_TOPIC_ARN" \
     --subject "<Subject>" \
     --message '<Message>' \
     --region eu-west-2
   ```

   Then delete every handled message, replayed or stale, from the queue:

   ```bash
   aws sqs delete-message \
     --queue-url "$QUEUE_URL" \
     --receipt-handle "<ReceiptHandle>" \
     --region us-east-1
   ```

   Repeat steps 3 to 5 until the queue is empty. `failure-queue-not-empty` returns to `OK` within a
   5 minute period.

6. **If `failure-queue-undelivered` fired**, the notification was never stored and cannot be
   replayed. List the edge alarms that changed state in the window and treat each as if it had just
   fired:

   ```bash
   aws cloudwatch describe-alarm-history \
     --history-item-type StateUpdate \
     --start-date "<ISO 8601 time the alarm fired, minus 10 minutes>" \
     --query "AlarmHistoryItems[].{When:Timestamp,Alarm:AlarmName,Summary:HistorySummary}" \
     --output table \
     --region us-east-1
   ```

   Then find out why the queue refused the message. The usual cause is the relay role losing access
   to the queue or to its key, `alias/${STAGE}-flex-alerts-relay-health-key`. Redeploying
   `${STAGE}-FlexGlobal` restores both grants.

## After recovery

Confirm all six relay alarms for the stage are in `OK` and the failure queues are empty. Then follow
[After recovery](/flex/runbooks/overview/#after-recovery).
