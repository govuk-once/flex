# Data Classification and Encryption

This document describes the classification of persistent FLEX data, and the encryption controls applied to it at rest. This document records the technical mapping: classification policy follows the [Government Security Classifications](https://www.gov.uk/government/publications/government-security-classifications) and is owned by security governance.

---

## Classification

FLEX currently exclusively persists operational log data: CloudWatch log groups (Lambda, API Gateway access and execution logs), VPC flow logs, S3 access logs and Macie findings. There are no application data stores (no DynamoDB tables and no application S3 buckets). Secrets and PII are prevented from reaching logs by the controls described in [Log Redaction and Filtering](/docs/log-redaction.md), with Macie scanning as a backup.

Everything FLEX persists is classified OFFICIAL and handled as internal data under a single encryption baseline. There is no per-class policy because there is _currently_ only one class.

> This assumption must be revisited the first time a domain adds a persistent application data store (a DynamoDB table, an application S3 bucket, etc), at which point the classification of that store should be agreed with security governance before it is built. Caching will also require additional considerations when it is implemented.

The one store holding user records is the Cognito user pool, which does not support customer managed keys for pool data; its contents are encrypted at rest by AWS.

---

## Encryption baseline at rest

| Store                              | Control                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| CloudWatch log groups              | Customer managed KMS key with rotation (`alias/flex-log-group-key`)              |
| CloudWatch log groups in us-east-1 | Per-stage customer managed key in the global stack (log groups are regional)     |
| VPC flow log bucket                | Customer managed KMS key (`alias/flex-vpc-flow-logs-key`)                        |
| Macie results bucket               | Customer managed KMS key                                                         |
| S3 access log buckets              | SSE-S3, as S3 server access log delivery does not support KMS customer keys      |
| Alarm SNS topics                   | Customer managed KMS key (`alias/flex-alerts-key`)                               |
| Lambda environment variables       | Environment-level customer managed key (`FlexEncryptionKey`, from `flex-params`) |

The log group key for eu-west-2 is provisioned in the core stack and its ARN published over SSM (`/<env>/flex/kms/log-group-key-arn`), so it is created once per environment and shared by every stage stack.

---

## Enforcement

Two mechanisms keep new resources on the baseline:

1. The `EncryptLogGroups` aspect (`platform/infra/flex/src/aspects/encrypt-log-groups.ts`) is applied app-wide and sets the key on every synthesised log group that does not already have one, including log groups created by CDK internals (custom resource providers, bucket deployments, CDK-managed Lambda log groups).
2. Checkov runs against the synthesised CloudFormation in CI quality checks. The log group encryption check (`CKV_AWS_158`) is active (it was previously inactive), so an unencrypted log group fails the build.
