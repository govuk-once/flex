---
title: Data and encryption
description: What data Flex stores, how it is classified, how it is encrypted at rest, and what keeps new resources on that baseline.
---

This page maps what Flex stores to the encryption applied to it. Classification policy follows the
[Government Security Classifications](https://www.gov.uk/government/publications/government-security-classifications)
and is owned by security governance; this page records how Flex applies it.

## What Flex stores

Flex stores operational data only:

- CloudWatch log groups: Lambda function logs, API Gateway access and execution logs, CloudFront
  Function logs
- VPC flow logs, in S3
- S3 server access logs and CloudFront access logs, in S3
- Macie discovery results, in S3
- the OpenAPI specs and Swagger UI served under `/docs`, in S3
- alarm and release notifications passing through SNS, and failed alarm relays in SQS
- two generated secrets: the origin verify header and the E2E WAF bypass token

Flex has no application data store. It creates no DynamoDB table and no S3 bucket for application
data. Where a gateway reads or writes data, such as the travel gateway's DynamoDB tables, the data
lives in the upstream's own account, reached through an assumed role. Flex creates no Cognito user
pool either: the authorizer reads the user pool ID from `flex-params`.

Logs are kept free of secrets and personal data by the sanitiser described in
[Logging](/flex/observability/logging/), with Macie scanning the CloudFront access logs as a backup.

Everything Flex stores is classified OFFICIAL and handled as internal data, under one encryption
baseline. There is one class, so there is no per-class policy.

:::caution[Revisit before adding a data store]
The single classification holds only while Flex stores operational data. Before a domain or gateway
adds a persistent store of its own, such as a DynamoDB table or an application S3 bucket, agree
that store's classification with security governance. Caching needs the same review when it is
added.
:::

## Encryption at rest

| Store | Encryption | Created in |
| --- | --- | --- |
| CloudWatch log groups in eu-west-2 | Customer managed KMS key with rotation, `alias/flex-log-group-key` | Core stack, shared by every stage in the environment |
| CloudWatch log groups in us-east-1, global stack | Customer managed key, `alias/<stage>-flex-global-log-group-key` | Global stack |
| CloudWatch log groups in us-east-1, Macie stack | Customer managed key, `alias/flex-macie-log-group-key` | Macie stack |
| VPC flow log bucket | Customer managed key, `alias/flex-vpc-flow-logs-key` | Core stack |
| Macie results bucket | Customer managed key, `alias/flex-macie-results-key` | Macie stack |
| Alarm and release SNS topics | Customer managed key, `alias/flex-alerts-key` | Core stack |
| Alarm relay SNS topics in us-east-1 | Customer managed keys, `alias/<stage>-flex-alerts-relay-key` and `alias/<stage>-flex-alerts-relay-health-key` (also used by the relay failure queues) | Global stack |
| Lambda environment variables | The environment's customer managed key, from `/<env>/flex-param/secret/encryption-key` | Created outside this repository, in `flex-params` |
| S3 server access log buckets and the CloudFront access log bucket | SSE-S3. S3 server access log delivery does not support customer managed keys. | Global stack |
| OpenAPI spec bucket | SSE-S3 | Global stack |
| Origin verify and E2E bypass secrets | Secrets Manager's AWS managed key, so they can replicate across regions | Platform and global stacks |

Every customer managed key Flex creates has rotation turned on.

The eu-west-2 log group key is created once per environment, in the core stack, which publishes its
ARN at `/<env>/flex/kms/log-group-key-arn`. Stage stacks in eu-west-2 read it from there. Log groups
are regional, so the us-east-1 stacks each create their own key. Each key's policy lets CloudWatch
Logs in its region use it for log groups in that account and region only.

Only functions built with the three [Lambda constructs](/flex/infrastructure/lambda-constructs/)
encrypt their environment with the Flex key. Functions CDK creates for itself, such as custom
resource providers and the bucket deployment, and the alarm relay and JWKS stub functions, use the
Lambda service key. Checkov's `CKV_AWS_173` is skipped app-wide for this reason.

## Enforcement

These keep new resources on the baseline:

1. **The `EncryptLogGroups` aspect**
   ([`src/aspects/encrypt-log-groups.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/aspects/encrypt-log-groups.ts))
   runs over the whole app. It sets the stack's log group key on every CloudFormation log group
   that has no key, including those CDK creates for its own functions and custom resources. In a
   stack that creates its own key, it uses that key; otherwise it reads the ARN from SSM.
2. **Checkov** runs over the synthesised templates in CI. The log group encryption check,
   `CKV_AWS_158`, is active, so an unencrypted log group fails the build. See
   [Security scanning](/flex/delivery/security-scanning/).
3. **The `EnforceS3Https` aspect** adds a statement to every bucket's policy that denies requests
   not made over TLS. For buckets that already exist in an account, `pnpm s3:enforce-tls`
   reports which bucket policies lack that statement, and adds it with `--apply`. It covers every
   bucket in the account unless given `--bucket` or `--buckets`, and `--no-ephemeral` skips personal
   and PR stage buckets. The S3 client's region is `--region`, then `AWS_REGION`, then eu-west-2.
4. **Macie** runs a weekly scheduled job, every Monday, over the CloudFront access log bucket in
   each persistent environment, with AWS's recommended managed data identifiers. Results go to the
   KMS-encrypted results bucket. `src/macie-coverage.ts` lists the domains whose data has been
   assessed against those identifiers, and any custom identifiers they need.

The aspect only reaches log groups that are CloudFormation resources. Two kinds of log group are
created by AWS services at run time instead, so they use CloudWatch Logs' default encryption rather
than the Flex key:

- API Gateway execution logs (`API-Gateway-Execution-Logs_<api id>/prod`). The platform stack only
  sets their retention.
- CloudFront Function logs, written by CloudFront in us-east-1.
