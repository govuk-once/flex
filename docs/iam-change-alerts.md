# IAM change alerts

FLEX uses EventBridge to send alerts for individual IAM, Lambda and CloudFormation API calls, including denied calls, to the environment's alerting Slack channel.

## Rules and events

Rules match `AWS API Call via CloudTrail` events on the default event bus.

| Rule | Region | Stack | CloudTrail `eventName` values |
| --- | --- | --- | --- |
| IAM change | `us-east-1` | `FlexGlobalStack` | `CreateRole`, `PutRolePolicy`, `AttachRolePolicy`, `CreatePolicyVersion`, `SetDefaultPolicyVersion`, `UpdateAssumeRolePolicy`, `DeleteRolePermissionsBoundary`, `PutRolePermissionsBoundary` |
| Lambda function change | `eu-west-2` | `FlexCoreStack` | `CreateFunction20150331`, `UpdateFunctionConfiguration20150331v2`, `UpdateFunctionCode20150331v2` |
| Lambda function change | `us-east-1` | `FlexGlobalStack` | `CreateFunction20150331`, `UpdateFunctionConfiguration20150331v2`, `UpdateFunctionCode20150331v2` |
| CloudFormation call | `eu-west-2` | `FlexCoreStack` | `CreateStack`, `UpdateStack`, `CreateChangeSet`, `ExecuteChangeSet` |
| CloudFormation call | `us-east-1` | `FlexGlobalStack` | `CreateStack`, `UpdateStack`, `CreateChangeSet`, `ExecuteChangeSet` |

The sources are `aws.iam` / `iam.amazonaws.com`, `aws.lambda` / `lambda.amazonaws.com` and `aws.cloudformation` / `cloudformation.amazonaws.com`. Lambda event names are exact CloudTrail names, rather than API names or a `CreateFunction` prefix that would also match `CreateFunctionUrlConfig`.

IAM events reach EventBridge only in `us-east-1`, including changes made while deploying stacks in `eu-west-2`. Lambda and CloudFormation events arrive in the Region of the call.

Rules are deployed in development, staging and production. They cover each whole account, including temporary stages and non-FLEX resources.

## Routing and delivery monitoring

`eu-west-2` rules publish to `flex-alerts-critical`. `us-east-1` rules use the critical SNS/Lambda relay to reach that topic. The topic feeds the environment's alerting Slack channel.

Each rule has a 14-day dead-letter queue with its own KMS key and warning alarms for undelivered or lost alerts. Use the [IAM Change Alert runbook](/docs/runbooks/iam-change-alert.md) when an alert arrives.

## Deployment exclusions

The exclusions use these default CDK bootstrap roles:

- Execution role: `arn:<partition>:iam::<account>:role/cdk-hnb659fds-cfn-exec-role-<account>-<region>`.
- Deploy role: `arn:<partition>:iam::<account>:role/cdk-hnb659fds-deploy-role-<account>-<region>`.

IAM and Lambda calls are suppressed only when both `detail.userIdentity.sessionContext.sessionIssuer.arn` is an excluded execution role and `detail.userIdentity.invokedBy` is `cloudformation.amazonaws.com`. The IAM rule excludes the execution roles for both Regions, because an IAM change made by the London execution role is recorded in `us-east-1`. Each Lambda rule excludes only its own Region's execution role.

CloudFormation calls are suppressed when the session issuer is that Region's deploy role. An absent issuer or, for IAM and Lambda, an absent `invokedBy` still matches the rule.

The exclusions also suppress misuse of these bootstrap roles; they cannot establish that a deployment was authorised. Update the exclusions if the bootstrap qualifier or role names change.

## Prerequisites and verification after deployment

A logging CloudTrail trail, including an organisation trail, must cover write management events in both Regions and global service events. FLEX does not create this trail. Event history alone is insufficient; [CloudTrail events in EventBridge require a logging trail](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-service-event-cloudtrail.html).

Verify in development first, then confirm prerequisites and delivery in staging and production.

1. Confirm with the trail owner that logging is active and the required events are selected. Confirm that the rules are enabled in the Regions above and the Slack subscription is connected.
2. From an authorised non-deployment identity, create a temporary test IAM role with no permissions and a restrictive trust policy. Record the time, actor and role name. Do not use a CDK bootstrap role for this check.
3. Find the `CreateRole` record in CloudTrail in `us-east-1` and confirm an **IAM change in development** message arrives in Slack with the same actor and role. Remove the temporary role after the check. Treat a missing Slack message as a failure.
4. Verify an authorised test Lambda change and CloudFormation call in each Region. Confirm the corresponding Slack messages, including a denied call where practical, and check an existing global CloudWatch alarm notification still reaches Slack through the relay.
5. During a legitimate CDK deployment, inspect the session issuer and `invokedBy` in the CloudTrail records. Confirm expected deployment calls are excluded, including IAM changes made by the `eu-west-2` execution role. Record the result and any unexpected alerts.

If a recorded event has no Slack message, check the rule pattern, EventBridge delivery metrics, SNS and KMS permissions, and the rule's dead-letter queue. For relay failures, use the [Alarm Relay Failure runbook](/docs/runbooks/alarm-relay-failures.md).

## Limits of detection

Alerts do not prove escalation or invocation. The rules neither inspect policy contents nor correlate calls.

`PassRole` has no CloudTrail event; inspect the consuming Lambda create or configuration call. These rules do not detect `Invoke`, whose logging requires separate data-event selection. See [PassRole](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_passrole.html) and [Lambda CloudTrail logging](https://docs.aws.amazon.com/lambda/latest/dg/logging-using-cloudtrail.html).

CloudTrail and EventBridge delivery is best effort. Dead-letter queues protect failed target delivery after matching; they cannot recover events that never reach a rule. Missing alerts do not rule out changes.
