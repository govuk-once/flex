# IAM Change Alert

Use this runbook for **IAM change**, **Lambda function change** or **CloudFormation call** alerts in the environment's alerting Slack channel, and their delivery warnings.

Alternatively, go to the [Runbooks](/docs/runbooks/README.md) page to find available runbooks.

## Scope

Alerts cover the whole account, including temporary stages and non-FLEX resources.

An alert reports one API call, including failed or denied calls; it does not prove escalation or misuse. See [IAM change alerts](/docs/iam-change-alerts.md) for events and exclusions.

---

## Prerequisites

- Assume the read-only role for the target environment via the GDS CLI, following [Environment Setup](/docs/environment-setup.md#aws-configuration-using-gds-cli).
- Use `us-east-1` for IAM records. For Lambda and CloudFormation, use the Region in the alert.

---

## Establish What Happened

1. Save the Slack message link. Establish the fields and outcome from the CloudTrail record.
2. Find and save the matching CloudTrail record using the account, Region, event name, time, actor and resource. For `ExecuteChangeSet` without `stackName`, resolve the change set to its stack.
3. Check `errorCode`, `errorMessage` and the current resource state.
4. Confirm the session owner and exact change against approved work or a deployment run. Record the confirmation and change link.

### Legitimate or suspicious

| Signal | What to check |
| --- | --- |
| Expected CDK deployment | Check the session issuer and `userIdentity.invokedBy`. IAM and Lambda exclusions require the expected execution role and `cloudformation.amazonaws.com`; an absent field can cause a legitimate deployment to alert. |
| Broader permissions | Compare inline policies, attached managed policies and default policy versions with the approved state. Check whether a boundary was removed or replaced. |
| Changed trust policy | Identify any newly trusted principal or weakened condition, especially cross-account access. Establish who can now assume the role. |
| Lambda change | Check the execution role, configuration and deployed code against the approved artefact. A code update can use privileges already held by the function. |
| Unexpected CloudFormation call | Inspect the template or change set and service role. A permitted stack operation can make IAM or Lambda changes using that role's permissions. |

Bootstrap-role misuse can be suppressed; inspect CloudTrail even when no further alerts arrive.

---

## Immediate Response

1. Have an authorised Platform operator contain misuse of the identity, role trust, credentials or sessions through the incident process. For exposed credentials, follow [Leaked Secret](/docs/runbooks/leaked-secret.md).
2. Preserve CloudTrail records and affected policies, trust, boundaries, code or change sets before restoring the approved state. Check dependants before changing stacks or roles.
3. Review related IAM, STS, Lambda and CloudFormation events and resources using the affected role. Missing `Invoke` records cannot rule out execution; Lambda data-event logging is separate.

---

## Undelivered or Lost Alerts

The warning alarm name starts with the environment and contains `iam-change-alert`, `lambda-change-alert` or `cloudformation-change-alert`.

| Alarm suffix | Response |
| --- | --- |
| `-undelivered` | An alert is waiting in the rule's dead-letter queue. Find the queue in the regional `FlexCore` or `FlexGlobal` stack, read the event and inspect its `ERROR_CODE` and `ERROR_MESSAGE` attributes. Investigate the original change as well as the delivery failure. |
| `-lost` | EventBridge could not deliver to either the critical topic or the dead-letter queue. Find the original call in CloudTrail and check SNS, SQS and KMS permissions and the relevant rule metrics. |

Queues retain messages for 14 days. Reading requires `sqs:ReceiveMessage` and `kms:Decrypt` on the queue's key. Preserve messages until investigation and recovery are agreed.

`us-east-1` delivery warnings use the warning relay. Topic-key or relay failures can silence them; check CloudWatch and the [Alarm Relay Failure runbook](/docs/runbooks/alarm-relay-failures.md).

---

## Escalation and Communication

Report suspected misuse in `#govuk-app-incident` and flag `#govuk-once-flex-dev`. Link the incident and alert, and state impact and actions taken.

Follow the [GOF Incident Process](https://gdsgovukagents.atlassian.net/wiki/spaces/GOF/pages/79495229/Incident+Process) and [GDS incident management guidance](https://gds-way.digital.cabinet-office.gov.uk/standards/incident-management.html#how-to-manage-technical-incidents).

## Related

- [IAM change alerts](/docs/iam-change-alerts.md)
- [Leaked Secret](/docs/runbooks/leaked-secret.md)
- [Alarm Relay Failure](/docs/runbooks/alarm-relay-failures.md)
