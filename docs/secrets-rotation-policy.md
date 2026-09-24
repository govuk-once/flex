# Secrets & Credentials Lifecycle Policy

## Purpose

This document defines the lifecycle policy for all credential types used by Flex, covering rotation cadence, expiry alerting, periodic access review, and pipeline secret hygiene.

---

## 1. Credential Inventory

### 1.1 Infrastructure Secrets (Secrets Manager)

Self-generated random strings managed in CDK code. No external dependency; values can be rotated freely.

| Secret | Path | Purpose | Created In |
|--------|------|---------|------------|
| E2E Bypass Secret | `/${stage}/flex-secret/waf/e2e-bypass` | WAF bypass header value for E2E tests | `platform/infra/flex/src/stacks/global.ts` |
| Origin Verify Secret | `/${stage}/flex-secret/origin-verify-secret` | CloudFront-to-API Gateway origin verification header | `platform/infra/flex/src/stacks/platform.ts` |

Both secrets are 32-character random strings (no punctuation) and are replicated cross-region (E2E Bypass to `eu-west-2`, Origin Verify to `us-east-1`).

### 1.2 External Service Credentials (Secrets Manager)

API credentials for third-party services. The ARN is referenced via SSM Parameter Store; the secret value is provisioned externally.

| Secret | SSM Pointer Path | Purpose | Fields |
|--------|-----------------|---------|--------|
| DVLA Consumer Config | `/dvla/consumer-config-secret-arn` | DVLA API authentication | apiKey, apiUrl, apiUsername, apiPassword, wellKnownJwkUrl |
| UDP Consumer Config | `/udp/consumer-config-secret-arn` | UDP API authentication | apiAccountId, apiKey, apiUrl, consumerRoleArn, region, externalId |
| UNS Consumer Config | `/uns/consumer-config-secret` | UNS API authentication | apiKey, apiUrl, privateApiUrl, region, roleArn |

### 1.3 Test and E2E Secrets (Secrets Manager)

Credentials used exclusively for automated testing. Not present in production traffic paths.

| Secret | Path | Purpose | Stages |
|--------|------|---------|--------|
| E2E Private JWK | `/development/flex-secret/auth/e2e/private_jwk` | Private key for stub token signing | Development only |
| Smoke Test User | `/${env}/flex-secret/smoke-test/user` | Smoke test user credentials | All environments |
| E2E Test User | `/${stage}/flex-secret/e2e/test_user` | E2E test user credentials | Staging, Production |

### 1.4 JWT Signing Keys (Cognito)

| Credential | Environment | Management | Rotation |
|------------|-------------|------------|----------|
| Cognito JWKS signing keys | Production, Staging | AWS-managed (Cognito) | Automatic (AWS handles key rotation internally) |
| Stub RSA key pair | Development | Self-managed via Secrets Manager | Manual (see Category C rotation) |

Production and staging JWT verification uses the standard Cognito JWKS endpoint (`https://cognito-idp.eu-west-2.amazonaws.com/{poolId}/.well-known/jwks.json`). Cognito automatically rotates its signing keys; no action is required from Flex.

The development stub key pair is stored in Secrets Manager at `/development/flex-secret/auth/e2e/private_jwk` and served via a Lambda Function URL that mimics the Cognito JWKS endpoint.

### 1.5 Cognito App Client

| Credential | Type | Secret Required |
|------------|------|-----------------|
| Cognito App Client ID | Public client | No — uses PKCE (S256 code challenge) |

The Cognito app client is configured as a **public client** with no client secret. Authentication uses the Authorization Code flow with PKCE. The client ID is stored as a plain SSM parameter at `/${env}/flex-param/auth/client-id`.

The user pool and client are provisioned externally in the [`flex-params`](https://github.com/govuk-once/flex-params) repository, owned by the Platform team. Flex consumes these as read-only SSM parameters — any changes to the user pool or client configuration require coordination with the Platform team via `flex-params`.

### 1.6 API Certificates (ACM / CloudFront SSL)

| Certificate | Region | Validation | Cross-Account |
|-------------|--------|------------|---------------|
| FlexCert (ACM) | us-east-1 | DNS (Route 53 hosted zone) | No — same account |

A single ACM certificate is provisioned in `platform/infra/flex/src/stacks/global.ts` for the CloudFront distribution. It is DNS-validated against a hosted zone whose metadata is imported from SSM (`/infra/dns/hostedzoneid`, `/infra/dns/hostedzonename`). The hosted zone itself is managed by the Platform team; Flex owns the certificate resource and its CDK definition.

ACM certificates used with CloudFront are automatically renewed by AWS (up to 60 days before expiry) when DNS validation records remain in place. No manual rotation is required.

**TLS policies enforced:**
- CloudFront: `TLS_V1_2_2021` minimum protocol version
- API Gateway: `SecurityPolicy_TLS13_1_2_2021_06`

### 1.7 Pipeline Secrets (GitHub Actions)

| Secret | Type | Purpose | Credential? |
|--------|------|---------|-------------|
| `DEV_DEPLOYMENT_ROLE` | IAM Role ARN | AWS access for dev deployments | No (OIDC federation) |
| `STAGING_DEPLOYMENT_ROLE` | IAM Role ARN | AWS access for staging deployments | No (OIDC federation) |
| `PROD_DEPLOYMENT_ROLE` | IAM Role ARN | AWS access for prod deployments | No (OIDC federation) |
| `SONAR_TOKEN_FLEX` | API token | SonarQube authentication | Yes |
| `SONAR_URL` | URL | SonarQube server address | No |
| `STAGING_API_URL` | URL | ZAP DAST scan target | No |
| `GITHUB_TOKEN` | Auto-generated | GitHub API access | No (automatic, per-run) |

**Security posture:** All AWS access uses OIDC federation — no long-lived AWS credentials are stored in GitHub. Action versions are pinned to commit SHAs, and `persist-credentials: false` is set on all checkouts.

Only **`SONAR_TOKEN_FLEX`** is a true stored credential secret requiring periodic rotation.

### 1.8 Service-to-Service Authentication

| Pattern | Mechanism | Secret-Based |
|---------|-----------|--------------|
| CloudFront → API Gateway | Shared secret in `x-origin-verify` header, WAF-validated | Yes (covered in 1.1) |
| E2E tests → CloudFront WAF | Shared secret in `x-flex-e2e-bypass` header | Yes (covered in 1.1) |
| Internal Lambda → Private API Gateway | IAM SigV4 signing + VPC endpoint restriction | No |
| Cross-account external APIs (UDP, UNS) | STS AssumeRole + SigV4 signing + ExternalId | No |
| External API keys (DVLA, UDP, UNS) | API keys from Secrets Manager passed as headers | Yes (covered in 1.2) |
| Client → Public API | Cognito JWT verified by Lambda authorizer | No |
| Smoke test → Firebase | GCP Workload Identity Federation + App Check | No |
| mTLS | Not used | N/A |

Internal service-to-service communication is entirely IAM-based (SigV4 signed requests over VPC endpoints). No shared secrets exist between internal Flex services.

---

## 2. Rotation Policy

### Category A — Infrastructure Secrets (30-day auto-rotation)

| Attribute | Value |
|-----------|-------|
| Secrets | E2E Bypass Secret, Origin Verify Secret |
| Rotation interval | 30 days |
| Mechanism | Automatic (Secrets Manager rotation schedule with Lambda) |
| Owner | Flex team |
| Rationale | Self-generated random strings with no external dependency. Frequent rotation is low-risk and high-value — limits exposure window with no coordination overhead. |
| Dependencies | WAF rules and CloudFront custom headers reference the current secret value at runtime. Rotation Lambda must update both the secret and any downstream consumers atomically. Cross-region replication propagates the new value automatically. |
| Risks | Transient mismatch during rotation window if a request arrives between secret update and replica propagation (mitigated by Secrets Manager's `AWSPENDING` / `AWSCURRENT` staging labels). |

**Implementation path:** Add a CDK `SecretRotation` construct (or a `RotationSchedule` with `automaticallyAfterDays: 30`) using the `SecretsManagerRotationSingleUser` application. The rotation Lambda generates a new 32-character random string and updates `AWSCURRENT`. No external API calls required.

### Category B — External Service Credentials (90-day coordinated rotation)

| Attribute | Value |
|-----------|-------|
| Secrets | DVLA Consumer Config, UDP Consumer Config, UNS Consumer Config |
| Rotation interval | 90 days (or per provider contract, whichever is shorter) |
| Mechanism | Manual, coordinated with external service provider |
| Owner | Flex team (rotation execution) + external provider (new credential issuance) |
| Rationale | These credentials authenticate against third-party APIs (DVLA, UDP, UNS). Rotation requires the provider to issue a new key/password and FLEX to update the stored value. Unilateral rotation would break authentication. |
| Dependencies | Provider must support credential regeneration. Downstream Lambdas cache the secret value for up to 600 seconds (`maxAge` in Powertools parameters). A redeploy forces cold starts to pick up the new value immediately. |
| Risks | Service disruption if the old credential is revoked before the new value propagates to all warm Lambda containers. Mitigate by deploying immediately after updating the secret. |

**Implementation path:**
1. Establish rotation calendar (90-day cadence) with alerts via team calendar or automated reminder.
2. Follow the rotation steps in the [Leaked Secret Runbook](/docs/runbooks/leaked-secret.md#rotating-and-redeploying-affected-services) — the same `put-secret-value` + redeploy process applies to planned rotation.
3. Long-term: if the provider offers an API for key regeneration, implement a custom rotation Lambda that automates the full cycle.

### Category C — Test and E2E Secrets (90-day manual rotation)

| Attribute | Value |
|-----------|-------|
| Secrets | E2E Private JWK, Smoke Test User, E2E Test User |
| Rotation interval | 90 days |
| Mechanism | Manual or script-assisted |
| Owner | Flex team |
| Rationale | Low-risk secrets used only in non-production test flows. Rotation must coordinate with CI/CD pipelines and test infrastructure to avoid breaking automated tests. |
| Dependencies | E2E test suites, smoke tests, and performance tests all consume these secrets at runtime. Rotation must be followed by verifying the full test suite passes. |
| Risks | Broken CI/CD pipelines if rotation is not coordinated with test infrastructure updates. |

**Implementation path:**
1. Create a rotation script that generates new test credentials and updates the secret value.
2. For the private JWK: generate a new key pair, update the secret, and update any corresponding public key references.
3. Run the full E2E and smoke test suites to validate.

### Category D — Pipeline Secrets (180-day rotation)

| Attribute | Value |
|-----------|-------|
| Secrets | `SONAR_TOKEN_FLEX` |
| Rotation interval | 180 days |
| Mechanism | Manual — regenerate in SonarQube, update GitHub repository secret |
| Owner | Flex team |
| Rationale | Only one true credential exists in the pipeline (`SONAR_TOKEN_FLEX`). All AWS access uses OIDC federation (keyless). Low rotation frequency acceptable given limited blast radius (code quality scanning, not production access). |
| Risks | Broken quality checks pipeline until the new token propagates. Schedule rotation during low-activity periods. |

**Rotation steps:**
1. Generate a new token in SonarQube (Project Settings → Security → Tokens).
2. Update the `SONAR_TOKEN_FLEX` repository secret in GitHub (Settings → Secrets and variables → Actions).
3. Trigger a PR build to verify the new token works.
4. Revoke the old token in SonarQube.

### Category E — AWS-Managed Credentials (No action required)

| Credential | AWS Service | Rotation |
|------------|-------------|----------|
| Cognito JWT signing keys | Cognito | Automatic (AWS-managed) |
| ACM certificate (FlexCert) | ACM | Auto-renewed 60 days before expiry (DNS validation) |
| OIDC federation tokens | STS | Per-request (short-lived, ~1 hour) |
| Lambda execution role credentials | STS | Automatic (rotated by Lambda runtime) |
| STS AssumeRole credentials (UDP, UNS) | STS | Per-invocation with 5-minute memoization |
| GitHub Actions `GITHUB_TOKEN` | GitHub | Per-workflow-run |

These credentials require no manual rotation or alerting.

---

## 3. Rotation Procedures

### 3.1 Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| Flex Engineer (Executor) | Performs rotation for Flex-owned secrets (infrastructure, test/E2E, pipeline, service gateway credentials), verifies success, updates rotation log |
| Flex Lead (Approver) | Approves non-automated rotations for Flex-owned secrets, reviews rotation log, escalation point |
| Platform team | Owns Cognito user pool/client provisioning (via [`flex-params`](https://github.com/govuk-once/flex-params)), hosted zone DNS, and OIDC trust policies. Flex coordinates with Platform for changes to these resources |
| Domain teams | Aware of which secrets their domain consumes. Flag rotation issues affecting their domain to Flex team |
| External Provider Liaison | Coordinates with third-party providers (DVLA, UDP, UNS) for credential reissuance |
| Security team | Consulted on exceptions, reviews quarterly rotation compliance report, audits IAM trust policies |

### 3.2 Category A — Infrastructure Secrets (Automated)

**Who initiates:** Secrets Manager rotation schedule (automatic).

**Process:**
1. Secrets Manager invokes the rotation Lambda on the configured schedule (every 30 days).
2. Lambda generates a new 32-character random string and stages it as `AWSPENDING`.
3. Lambda tests the new value (validates WAF rule or CloudFront header acceptance).
4. On success, Lambda promotes `AWSPENDING` to `AWSCURRENT`.
5. Cross-region replication propagates the new value automatically.

**Verification:** The rotation Lambda's test step confirms the new value works before promotion. CloudWatch alarm fires on `RotationFailed` if any step fails.

**Rollback:** Secrets Manager retains the previous version as `AWSPREVIOUS`. If issues are detected post-rotation, manually promote `AWSPREVIOUS` back to `AWSCURRENT` via `aws secretsmanager update-secret-version-stage`.

**Human intervention required only on failure** (alert-triggered).

### 3.3 Category B — External Service Credentials (Manual, Coordinated)

**Who initiates:** Flex Engineer, triggered by calendar reminder or expiry alert.

**Process:**
1. Flex Engineer raises a rotation request with the external provider (DVLA, UDP, or UNS) at least 5 business days before the rotation deadline.
2. Provider issues new credentials and communicates them via secure channel.
3. Flex Engineer updates the secret value:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id <secret-arn> \
     --secret-string '<new-json-value>'
   ```
4. Flex Engineer triggers a deployment to force Lambda cold starts:
   ```bash
   npx cdk deploy --all
   ```
5. Flex Engineer verifies API connectivity by checking CloudWatch error metrics and running smoke tests against the affected domain.
6. Flex Engineer confirms with provider that the old credential can be revoked.
7. Provider revokes old credential.
8. Flex Engineer updates the rotation log with the date and next rotation due date.

**Approval:** Flex Lead must approve before step 3 (secret update in production).

**Verification:**
- Smoke tests pass for the affected domain (DVLA/UDP/UNS).
- No elevated 4xx/5xx error rates in CloudWatch for 30 minutes post-rotation.
- API response times remain within baseline.

**Rollback:** If the new credential fails verification before old credential revocation (step 7), revert to the previous value using `put-secret-value` with the old credentials and redeploy. If discovered after old credential revocation, escalate to provider for emergency reissuance.

### 3.4 Category C — Test and E2E Secrets (Manual/Scripted)

**Who initiates:** Flex Engineer, triggered by calendar reminder or expiry alert.

**Process:**
1. **E2E Private JWK:**
   - Generate a new RSA key pair: `node -e "const { generateKeyPairSync } = require('crypto'); ..."`
   - Update the secret at `/development/flex-secret/auth/e2e/private_jwk` with the new private JWK.
   - The stub JWKS endpoint Lambda automatically serves the updated public key on next invocation.
   - Run E2E test suite against development to verify token signing works.

2. **Smoke Test User / E2E Test User:**
   - Coordinate with the identity provider (Cognito/OneLogin) to reset or regenerate test user credentials.
   - Update the secret at `/${env}/flex-secret/smoke-test/user` or `/${stage}/flex-secret/e2e/test_user`.
   - Run the full smoke test and E2E test suites to validate.

3. Update the rotation log with the date and next rotation due date.

**Approval:** No formal approval required (non-production secrets). Notify team via Slack.

**Verification:**
- E2E test suite passes on all configured stages.
- Smoke tests pass on all environments.
- Performance test JWT pool generation succeeds.

**Rollback:** Restore previous secret value via Secrets Manager version history. Test secrets have no production impact, so rollback urgency is low.

### 3.5 Category D — Pipeline Secrets (Manual)

**Who initiates:** Flex Engineer, triggered by calendar reminder (180-day cadence).

**Process:**
1. Generate a new token in SonarQube (Project Settings → Security → Tokens). Do not revoke the old token yet.
2. Update the `SONAR_TOKEN_FLEX` repository secret in GitHub (Settings → Secrets and variables → Actions).
3. Trigger a PR build (or re-run an existing workflow) to verify the new token authenticates successfully.
4. Confirm SonarQube analysis completes and results are uploaded.
5. Revoke the old token in SonarQube.
6. Update `pipeline-secrets-last-rotated.json` and the team calendar for the next rotation date.

**Approval:** No formal approval required. Notify team via Slack.

**Verification:**
- CI quality checks job completes successfully with the new token.
- SonarQube dashboard shows updated analysis results.

**Rollback:** If the new token fails, the old token is still active (not yet revoked in step 5). Re-update the GitHub secret with the old token value. Investigate and retry.

### 3.6 Rotation Log

All manual rotations must be recorded in a rotation log. Each entry includes:

| Field | Description |
|-------|-------------|
| Date | When the rotation was performed |
| Secret | Which credential was rotated |
| Executor | Who performed the rotation |
| Approver | Who approved (if applicable) |
| Verification | How success was confirmed |
| Next due | Calculated next rotation date |
| Notes | Any issues encountered |

The rotation log is maintained as a shared document accessible to the Flex team and reviewed during quarterly access reviews.

---

## 4. Expiry Alerting

### 4.1 Secrets Manager Rotation Monitoring

For all secrets with configured rotation schedules, alerts fire when rotation fails or a secret approaches its rotation deadline.

| Alert | Trigger | Channel | Severity |
|-------|---------|---------|----------|
| Rotation failure | Secrets Manager emits `RotationFailed` CloudTrail event | CloudWatch Alarm → SNS → team notification | High |
| Rotation overdue | Secret's `LastRotatedDate` exceeds scheduled interval + 7-day grace | CloudWatch custom metric → SNS | Medium |
| Secret not accessed | Secret has no `GetSecretValue` calls for 90+ days (potential orphan) | CloudWatch Insights query → scheduled report | Low |

**Implementation approach:**
- CloudWatch EventBridge rule matching `aws.secretsmanager` `RotationFailed` events → SNS topic → Slack/email
- Scheduled Lambda (daily) that checks `LastRotatedDate` for all Flex secrets against their configured cadence and publishes a custom CloudWatch metric `SecretRotationOverdue`
- CloudWatch Alarm on `SecretRotationOverdue` metric → SNS topic

### 4.2 ACM Certificate Expiry

| Alert | Trigger | Channel | Severity |
|-------|---------|---------|----------|
| Certificate approaching expiry | ACM emits `DaysToExpiry` metric < 45 days | CloudWatch Alarm → SNS | High |
| Certificate renewal failed | ACM certificate status changes from `ISSUED` to `PENDING_VALIDATION` | EventBridge rule → SNS | Critical |

ACM auto-renews certificates 60 days before expiry when DNS validation is in place. The alert at 45 days catches cases where auto-renewal has failed (e.g., DNS validation records removed).

### 4.3 Pipeline Secret Expiry Reminders

| Alert | Trigger | Channel | Severity |
|-------|---------|---------|----------|
| SonarQube token rotation due | 180-day cadence timer | Calendar reminder + Slack notification | Medium |
| OIDC trust policy review due | Quarterly review cadence | Calendar reminder | Low |

Pipeline secrets do not have automated expiry detection (GitHub does not expose secret creation dates). Rotation tracking is maintained via:
- Team calendar entries at 180-day intervals for `SONAR_TOKEN_FLEX`
- A `pipeline-secrets-last-rotated.json` metadata file in the repository tracking rotation dates

### 4.4 External Credential Expiry

| Alert | Trigger | Channel | Severity |
|-------|---------|---------|----------|
| External credential rotation due | 90-day cadence from last rotation | Scheduled Lambda → SNS | Medium |
| API authentication failure spike | 4xx error rate from external APIs exceeds threshold | CloudWatch Alarm on API error metrics | High |

The 4xx error rate alarm acts as a backstop — if a credential expires or is revoked unexpectedly, the elevated error rate triggers an immediate alert before the scheduled rotation date.

---

## 5. Periodic Access Review Process

### 5.1 Schedule

| Review | Frequency | Owner | Participants |
|--------|-----------|-------|--------------|
| Secrets Manager access audit | Quarterly | Flex Lead | Flex team, Security |
| GitHub Actions secrets audit | Quarterly | Flex Lead | Flex team |
| IAM role trust policy review | Quarterly | Flex Lead | Flex team, Platform team, Security |
| Cognito / `flex-params` configuration review | Bi-annually | Platform team | Flex team (consulted) |
| External service credential audit | Bi-annually | Flex Lead | Flex team, external provider liaison |
| Full credential inventory reconciliation | Annually | Flex Lead | Flex team, Platform team, Security, Engineering Lead |

### 5.2 Secrets Manager Access Review

**What:** Review which IAM roles and principals have access to each Flex secret.

**How:**
1. Generate IAM Access Analyzer findings for Secrets Manager resources.
2. Cross-reference `secretsmanager:GetSecretValue` grants against the expected consumer list per secret.
3. Verify that no unexpected principals have been granted access.
4. Check CloudTrail logs for `GetSecretValue` calls from unexpected sources.
5. Remove any stale or unnecessary access grants.

**Output:** Updated access matrix documenting which roles access which secrets, with justification.

### 5.3 GitHub Actions Secrets Review

**What:** Verify that all pipeline secrets are still required, correctly scoped, and recently rotated.

**How:**
1. List all repository and environment secrets in GitHub.
2. Cross-reference against workflow files — identify any secrets that are configured but unused.
3. Verify OIDC role trust policies restrict to expected repositories and branches.
4. Confirm `SONAR_TOKEN_FLEX` was rotated within the last 180 days.
5. Review workflow permissions — ensure minimal `permissions:` blocks are declared.
6. Audit action version pins — confirm all third-party actions use commit SHA pins.

**Output:** Confirmation that all secrets are active, scoped, and rotated; removal of any orphaned secrets.

### 5.4 IAM Role Trust Policy Review

**What:** Verify cross-account role assumptions and OIDC trust relationships are correctly scoped.

**Who:** Flex team leads the review; Platform team participates for trust policies they provision (OIDC roles, cross-account roles in external accounts).

**How:**
1. Review trust policies on deployment roles (`DEV_DEPLOYMENT_ROLE`, `STAGING_DEPLOYMENT_ROLE`, `PROD_DEPLOYMENT_ROLE`) — verify OIDC conditions restrict to the correct GitHub repository and branch patterns. (Platform team provisions these roles; Flex team verifies conditions are correct.)
2. Review trust policies on cross-account roles assumed for UDP/UNS — verify ExternalId conditions and source account restrictions.
3. Verify permissions boundaries on Lambda execution roles remain correctly scoped (Flex-owned CDK code).
4. Check that `execute-api:Invoke` grants on the private API gateway are limited to expected routes.

**Output:** Trust policy audit log with any deviations flagged for remediation. Platform team remediates trust policy changes in their accounts; Flex team remediates permissions boundaries and API gateway grants.

### 5.5 External Service Credential Audit

**What:** Confirm external credentials are still valid, minimally scoped, and documented.

**How:**
1. Confirm each external credential (DVLA, UDP, UNS) successfully authenticates (non-invasive health check).
2. Verify credential scope matches documented permissions (no privilege escalation since last review).
3. Confirm provider contact information is current for rotation coordination.
4. Review whether any providers now support automated key regeneration APIs.

**Output:** Provider contact list update, credential scope confirmation, and automation opportunity log.

---

## 6. Pipeline Secret Hygiene Review Process

### 6.1 Principles

- **Keyless by default:** All AWS access uses OIDC federation. No long-lived AWS credentials are stored.
- **Minimal stored secrets:** Only credentials that cannot use federated auth are stored (`SONAR_TOKEN_FLEX`).
- **Pin-to-SHA:** All third-party GitHub Actions are pinned to commit SHAs, not mutable tags.
- **Least privilege:** Workflow permissions are declared explicitly per job, not inherited from repository defaults.
- **No credential persistence:** All checkouts use `persist-credentials: false`.

### 6.2 Hygiene Checklist (Run Quarterly)

| # | Check | Pass Criteria |
|---|-------|---------------|
| 1 | No long-lived AWS credentials in GitHub secrets | Only role ARNs exist; no `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
| 2 | OIDC conditions are restrictive | Trust policies include `sub` conditions matching repo + branch/environment |
| 3 | Action versions pinned to SHA | All `uses:` references use 40-character commit hashes |
| 4 | `persist-credentials: false` on checkouts | All `actions/checkout` steps include this flag |
| 5 | Minimal permissions declared | Each job declares only the permissions it needs; no `permissions: write-all` |
| 6 | No secrets in workflow logs | Workflow outputs and step summaries do not echo secret values |
| 7 | Environment protection rules active | Production deployments require approval gates |
| 8 | `SONAR_TOKEN_FLEX` rotated within 180 days | Check `pipeline-secrets-last-rotated.json` or team calendar |
| 9 | No orphaned secrets | All configured secrets are referenced in at least one workflow |
| 10 | Reusable workflows pass secrets explicitly | No use of `secrets: inherit` |

### 6.3 Ownership and Escalation

| Role | Responsibility |
|------|---------------|
| Flex team | Executes quarterly hygiene review, rotates pipeline secrets, maintains action pins, manages GitHub repository secrets |
| Platform team | Provisions and maintains OIDC deployment roles and their trust policies (consumed by Flex workflows) |
| Security team | Reviews OIDC trust policies, audits environment protection rules |
| Engineering Lead | Approves exceptions, escalation point for failed checks |

### 6.4 Remediation SLA

| Severity | Example | SLA |
|----------|---------|-----|
| Critical | Long-lived AWS credential found in GitHub | Immediate removal (< 1 hour), credential rotation, incident report |
| High | OIDC trust policy too permissive | 1 business day |
| Medium | Action pinned to tag instead of SHA | 5 business days |
| Low | Orphaned secret (configured but unused) | Next quarterly review |

---

## 7. Exceptions and Accepted Risks

| Secret | Exception | Justification | Review Date |
|--------|-----------|---------------|-------------|
| E2E Private JWK (`/development/...`) | Accept 90-day manual rotation instead of auto-rotation | Development-only signing key with no production exposure. Auto-rotation would require synchronising public/private key pairs across test infrastructure, adding complexity disproportionate to the risk. | 2027-02-24 |
| Smoke Test User | Accept 90-day manual rotation instead of auto-rotation | Test user credentials managed in conjunction with the identity provider's test environment. Auto-rotation depends on the provider supporting programmatic user credential updates. | 2027-02-24 |
| E2E Test User | Accept 90-day manual rotation instead of auto-rotation | Same rationale as Smoke Test User — credentials are tied to test identity provider configuration. | 2027-02-24 |
| External credentials (DVLA, UDP, UNS) | Accept 90-day manual rotation instead of auto-rotation | Rotation requires bilateral coordination with external providers who do not currently offer automated key regeneration APIs. | 2027-02-24 |

All exceptions should be reviewed at or before their review date to assess whether automation has become feasible.

---

## 8. Rotation Cadence Summary

| Credential Type | Cadence | Mechanism | Owner |
|-----------------|---------|-----------|-------|
| Infrastructure secrets (WAF) | 30 days | Automatic (Secrets Manager + Lambda) | Flex team |
| External service credentials | 90 days | Manual (coordinated with provider) | Flex team |
| Test/E2E secrets | 90 days | Manual/scripted | Flex team |
| Pipeline secrets (SonarQube) | 180 days | Manual (regenerate + update GitHub) | Flex team |
| Cognito user pool / client | N/A | Provisioned via `flex-params` | Platform team |
| Cognito JWT keys | Continuous | AWS-managed | AWS (via Platform team's Cognito setup) |
| ACM certificates | Auto-renewed | AWS-managed (DNS validation) | Flex team (CDK definition) / AWS (renewal) |
| OIDC deployment roles | N/A | Trust policies managed externally | Platform team |
| IAM/STS credentials | Per-request | AWS-managed | AWS |
| GitHub OIDC tokens | Per-workflow | GitHub-managed | GitHub |

---

## Related

- [`flex-params`](https://github.com/govuk-once/flex-params) — Platform team repository provisioning Cognito user pools, app clients, and external SSM parameters consumed by Flex
- [Leaked Secret Runbook](/docs/runbooks/leaked-secret.md) — incident response and manual rotation procedure
- [AWS Secrets Manager rotation documentation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
- [`platform/infra/flex/src/stacks/global.ts`](/platform/infra/flex/src/stacks/global.ts) — E2E Bypass Secret and CloudFront distribution
- [`platform/infra/flex/src/stacks/platform.ts`](/platform/infra/flex/src/stacks/platform.ts) — Origin Verify Secret and WAF rules
- [`platform/domains/dvla/gateway.config.ts`](/platform/domains/dvla/gateway.config.ts) — DVLA secret reference
- [`platform/domains/udp/gateway.config.ts`](/platform/domains/udp/gateway.config.ts) — UDP secret reference
- [`platform/domains/uns/gateway.config.ts`](/platform/domains/uns/gateway.config.ts) — UNS secret reference
- [`.github/workflows/`](/.github/workflows/) — Pipeline workflow definitions
