# Amazon Macie and KMS runbook

How FLEX runs Amazon Macie for S3 sensitive-data discovery, and exactly what you need to do about KMS, now and in future.

---

## Scope and why us-east-1

Macie is a **regional** service: it only discovers data in S3 buckets that live in the same region as the Macie session. FLEX's buckets that are fed from **outside** the application's log sanitiser live in `FlexGlobalStack`, which is deployed to **us-east-1**:

| Bucket | Stack / region | Content | Encryption | In Macie scope |
| --- | --- | --- | --- | --- |
| CloudFront access log bucket | `FlexGlobalStack` / us-east-1 | request URIs and query strings, written by CloudFront from the raw HTTP request | SSE-S3 | **Yes (primary)** |
| `flex-{stage}-openapi-specs` | `FlexGlobalStack` / us-east-1 | published OpenAPI specs, incl. `example:` values | SSE-S3 | **Yes (secondary)** |
| OpenAPI spec access log bucket | `FlexGlobalStack` / us-east-1 | S3 server access logs (object keys) | SSE-S3 | Yes (incidental) |
| VPC flow log bucket | `FlexCoreStack` / eu-west-2 | network metadata only | **KMS** (`alias/flex-vpc-flow-logs-key`) | No |

The CloudFront access log bucket is the one that matters: it captures the request URL, which the application log sanitiser (`libs/logging`) never sees, so any PII that reaches an endpoint via a path or query string lands there unredacted. That is the leak Macie is here to catch.

**All in-scope buckets are SSE-S3, so no KMS grant is required today.** Macie reads SSE-S3 objects with no extra key policy. The KMS work below is only needed if a scoped bucket is ever switched to a customer-managed KMS key, or if the KMS-encrypted flow-log bucket is later brought into scope.

---

## What the IaC creates

`FlexMacieStack` (`platform/infra/flex/src/stacks/macie.ts`), deployed only in `persistent` environments, in us-east-1:

1. **`CfnSession`** — enables Macie for the account/region and turns on continuous **automated sensitive data discovery** across the account's us-east-1 buckets. Finding publishing frequency is 15 minutes.
2. **Custom data identifiers** — one `CfnCustomDataIdentifier` per entry in `macieCoverage.customDataIdentifiers` (`platform/infra/flex/src/macie-coverage.ts`). This list is **empty today**. Verified against the AWS managed-data-identifiers reference: UK driving licence (`UK_DRIVERS_LICENSE`), National Insurance number, passport, full name, mailing address, phone, NHS number and bank account are all **managed** identifiers, so no custom pattern is needed for them. Custom identifiers are reserved for genuinely FLEX-specific unmanaged formats, of which there are none. When defined, they are defined centrally, not in domain configs, so an outsourced domain team cannot silently drop coverage. Note that automated discovery does not use custom identifiers unless they are added to the sensitivity inspection template.
3. **`MacieResultsBucket`** — a KMS-encrypted, versioned, private, retained bucket plus its own CMK (`alias/flex-macie-results-key`) for the detailed discovery-result export. The key and bucket policies grant the Macie service principal encrypt/put, scoped with `aws:SourceAccount` and `aws:SourceArn` confused-deputy conditions.
4. **`ExportConfig`** — points Macie's classification export at that bucket (`macie-results/` prefix). This call is idempotent.

### The Macie service-linked role (automatic)

Enabling the session auto-creates `AWSServiceRoleForAmazonMacie`:

```
arn:aws:iam::<ACCOUNT_ID>:role/aws-service-role/macie.amazonaws.com/AWSServiceRoleForAmazonMacie
```

Macie assumes this role to read S3 objects. For SSE-S3 buckets nothing further is needed. For KMS-encrypted buckets this role must be granted decrypt on the bucket's key — see below.

---

## KMS: what you need to do

### Today

**Nothing.** Every in-scope bucket is SSE-S3. The only KMS key the stack touches is the results key it creates for itself, and that policy is applied automatically.

### If a scoped bucket becomes KMS-encrypted (the manual step)

If the CloudFront access log bucket, the specs bucket, or any other bucket you bring into scope is switched to a customer-managed CMK, Macie cannot read it until the service-linked role is granted decrypt on that key. Add this statement to the **key policy** of the bucket's CMK:

```json
{
  "Sid": "AllowMacieDecrypt",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::<ACCOUNT_ID>:role/aws-service-role/macie.amazonaws.com/AWSServiceRoleForAmazonMacie"
  },
  "Action": ["kms:Decrypt"],
  "Resource": "*"
}
```

`kms:Decrypt` is the only action Macie requires to decrypt an object (per the current AWS guidance); `kms:DescribeKey` is not needed. `Resource: "*"` here means "this key", because a key policy is already scoped to the key it is attached to. To generate the exact set of CMK grants Macie needs across your buckets, AWS publishes a KMS Permission Analyzer script in the [amazon-macie-scripts](https://github.com/aws-samples/amazon-macie-scripts) repository.

In CDK, on the `Key` construct:

```ts
key.addToResourcePolicy(
  new PolicyStatement({
    sid: "AllowMacieDecrypt",
    effect: Effect.ALLOW,
    principals: [
      new ArnPrincipal(
        `arn:${stack.partition}:iam::${stack.account}:role/aws-service-role/macie.amazonaws.com/AWSServiceRoleForAmazonMacie`,
      ),
    ],
    actions: ["kms:Decrypt"],
    resources: ["*"],
  }),
);
```

Without this, Macie reports the bucket as unable to be analysed (access denied) rather than failing loudly, so it is easy to miss.

### If you bring the VPC flow-log bucket into scope

The flow-log bucket in eu-west-2 uses `alias/flex-vpc-flow-logs-key`. Its key policy today only grants the log-delivery **write** path; `kms:Decrypt` is deliberately withheld (see the comment in `stacks/core/vpc.ts` around the `FlowLogKey` definition: read access is to be granted in a follow-up "once a reader, e.g. an investigator role or Athena, is needed"). Macie would be exactly such a reader. Two things are required:

1. A **separate Macie session in eu-west-2** (the stack today only enables us-east-1), because Macie cannot scan across regions.
2. The `AllowMacieDecrypt` statement above added to `alias/flex-vpc-flow-logs-key`.

This is not recommended: flow logs are fixed-schema network metadata (IP addresses, ports, byte counts) with no free-text PII, so the scan cost buys little. Documented only so the path is known.

---

## Domain coverage and the CI gate

Adding a domain splits into three cases:

- **Bucket coverage** is automatic. New domain traffic flows through the same CloudFront distribution into the same us-east-1 access-log bucket, which is already in scope.
- **Standard PII** is automatic. Macie managed identifiers apply to every bucket regardless of which domain wrote the data.
- **A new unmanaged format** (a FLEX-specific internal reference or case ID that no managed identifier matches) is the only thing that needs a deliberate addition, and it is caught, not left to memory. Note that standard UK PII, including driving licences, is already managed, so this case is rare.

`platform/infra/flex/src/macie-coverage.ts` is the single, platform-owned source of truth. It holds `coveredDomains` (domains assessed in the current Macie review) and `customDataIdentifiers` (the central identifier registry the stack deploys).

`src/scripts/check-macie-coverage.ts` runs in CI (`pnpm run validate:macie-coverage`, wired into `.github/workflows/_quality-checks.yml`). It scans every `domains/*/domain.config.ts`, diffs against `coveredDomains`, and **warns without failing the pipeline**, listing any domain that has not been assessed:

```
warning: 1 domain(s) not covered by the Macie assessment:
- dwp-benefits: not assessed for Macie coverage. Review the data it handles, add any
  unmanaged PII format to customDataIdentifiers, then list it in coveredDomains ...
```

The check is non-blocking by design: standard PII is already covered by managed identifiers, so a missing entry is not a build-breaker, it is something to review. To make sure the warning is not lost, the workflow **posts the gap to Slack** when uncovered domains are found. It publishes an AWS Chatbot markdown notice to the SNS topic `/development/flex/topic/release-notifications` (the same CI to Slack path used by deployment notifications), gated on the scan's `uncovered` output and marked `continue-on-error` so a failed notification never breaks the build. Editing the coverage config is caught by `CODEOWNERS` review by the platform team. Stale entries (a listed domain that no longer exists) are reported too.

> Topic and role: the notice reuses the release-notifications topic in the development account and the `ROLE_TO_ASSUME` secret already passed into the quality-checks workflow. If that role cannot reach the dev-account topic in the PR context, point the step at a dedicated topic or a dev-account role.

---

## Exhaustive scan vs continuous discovery

The session gives you **continuous automated discovery**, which samples objects across the in-scope buckets and maintains per-bucket sensitivity scores and findings. That is the right control for ongoing monitoring, but it is sampling-based, not a guarantee that every object has been inspected.

For a **point-in-time exhaustive audit** (for example, evidence for an ITHC that every access-log object has been scanned), run a one-off classification job. There is no `CfnClassificationJob` in aws-cdk-lib 2.261, and job scope is immutable once created, so this is intentionally an operational command rather than IaC:

```bash
aws macie2 create-classification-job \
  --region us-east-1 \
  --job-type ONE_TIME \
  --name "flex-access-log-audit-$(date +%Y%m%d)" \
  --s3-job-definition '{
    "bucketCriteria": {
      "includes": {
        "and": [
          { "tagCriterion": {
              "comparator": "EQ",
              "tagValues": [{ "key": "System", "value": "FLEX" }]
          }}
        ]
      }
    }
  }' \
  --managed-data-identifier-selector RECOMMENDED
```

`System=FLEX` is a stack-level tag already applied to every FLEX bucket, so the criterion selects exactly the FLEX buckets in us-east-1 with no bucket-name wiring. `RECOMMENDED` uses the same default managed-identifier set as automated discovery (includes `UK_DRIVERS_LICENSE` and `UK_NATIONAL_INSURANCE_NUMBER`). To scan for the UK types that are not in the default set (`NAME`, `ADDRESS`, `UK_PHONE_NUMBER`, `UK_NHS_NUMBER`, `UK_BANK_ACCOUNT_NUMBER`), use `--managed-data-identifier-selector INCLUDE --managed-data-identifier-ids NAME ADDRESS UK_PHONE_NUMBER ...` instead.

---

## Prevention comes first

Macie is a **detective** control: it tells you PII already landed in the access-log bucket, it does not stop it. The primary control is preventing PII from appearing in URLs in the first place:

- keep identifiers out of path and query parameters (use the authenticated token / request body), which the current routes already do;
- add a contract check on OpenAPI path and query parameters so a new endpoint cannot introduce a PII-bearing URL unnoticed;
- optionally configure CloudFront to drop query strings from access logs.

Macie is the safety net for the day one of those fails.

---

## Verify a deployment

```bash
# Session is enabled in us-east-1
aws macie2 get-macie-session --region us-east-1

# Automated discovery is enabled and which managed identifiers it uses
aws macie2 get-automated-discovery-configuration --region us-east-1

# Export configuration points at the results bucket
aws macie2 get-classification-export-configuration --region us-east-1

# Per-bucket coverage and any access-denied (usually a missing KMS grant)
aws macie2 describe-buckets --region us-east-1 \
  --query 'buckets[].{name:bucketName,job:jobDetails,denied:errorCode}'
```

An `errorCode` of `ACCESS_DENIED` on a bucket almost always means the bucket is KMS-encrypted and the `AllowMacieDecrypt` grant above is missing.
