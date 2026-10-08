# Secrets & Credentials Lifecycle Policy

## Purpose

This document defines the lifecycle policy for all credential types used by Flex, covering rotation cadence, expiry alerting, periodic access review, and pipeline secret hygiene.

Each section clearly marks items as **Current** (implemented and active) or **Proposed** (target state, not yet implemented).

---

## 1. Credential Inventory

### 1.1 Infrastructure Secrets (Secrets Manager)

Self-generated random strings managed in CDK code. No external dependency; values can be rotated freely.

| Secret | Path | Purpose | Created In |
|--------|------|---------|------------|
| E2E Bypass Secret | `/${stage}/flex-secret/waf/e2e-bypass` | WAF bypass header value for E2E tests | `platform/infra/flex/src/stacks/global.ts` |
| Origin Verify Secret | `/${stage}/flex-secret/origin-verify-secret` | CloudFront-to-API Gateway origin verification header | `platform/infra/flex/src/stacks/platform.ts` |

Both secrets are 32-character random strings (no punctuation) and are replicated cross-region (E2E Bypass to `eu-west-2`, Origin Verify to `us-east-1`).

**Rotation status:** Neither secret has a rotation schedule configured. See [Category A (Proposed)](#category-a--infrastructure-secrets-proposed-30-day-auto-rotation).

### 1.2 Flex-Managed External Credentials (Secrets Manager)

Credentials where the secret resource is in the Flex AWS account (created by [`flex-params`](https://github.com/govuk-once/flex-params)) but the credential value is issued by an external provider.

| Secret | SSM Pointer Path | Purpose | Fields | Value Managed By | Rotation |
|--------|-----------------|---------|--------|------------------|----------|
| DVLA Consumer Config | `/dvla/consumer-config-secret-arn` | DVLA API authentication | apiKey, apiUrl, apiUsername, apiPassword, wellKnownJwkUrl | Flex (auto-rotated) | **Current**: 60-day automatic Lambda rotation |
| UNS Consumer Config | `/uns/consumer-config-secret` | UNS API authentication | apiKey, apiUrl, privateApiUrl, region, roleArn | UNS team (externally managed) | None — see [External Dependencies](#3-external-dependencies) |

### 1.3 Cross-Account External Credentials

Credentials where the secret resource lives entirely in another team's AWS account. Flex has no direct access to inspect or rotate these secrets.

| Secret | SSM Pointer Path | Purpose | Fields | Owner Account |
|--------|-----------------|---------|--------|---------------|
| UDP Consumer Config | `/udp/consumer-config-secret-arn` | UDP API authentication | apiAccountId, apiKey, apiUrl, consumerRoleArn, region, externalId | UDP team |

Flex accesses the UDP secret at runtime via cross-account IAM role assumption (STS AssumeRole with ExternalId). The SSM parameter pointing to the secret ARN is provisioned by `flex-params`, but the secret itself and its value are owned entirely by the UDP team. Flex cannot call `ListSecretVersionIds`, `DescribeSecret`, or any other Secrets Manager API against this resource.

**Rotation status:** Entirely the responsibility of the UDP team. See [External Dependencies](#3-external-dependencies).

### 1.4 Test and E2E Secrets (Secrets Manager)

Credentials used exclusively for automated testing. Not present in production traffic paths.

| Secret | Path | Purpose | Stages |
|--------|------|---------|--------|
| E2E Private JWK | `/development/flex-secret/auth/e2e/private_jwk` | Private key for stub token signing | Development only |
| Smoke Test User | `/${env}/flex-secret/smoke-test/user` | Smoke test user credentials | All environments |
| E2E Test User | `/${stage}/flex-secret/e2e/test_user` | E2E test user credentials | Staging, Production |

**Rotation status:** No automated rotation. See [Category C](#category-c--test-and-e2e-secrets-proposed-manual-rotation).

### 1.5 JWT Signing Keys (Cognito)

| Credential | Environment | Management | Rotation |
|------------|-------------|------------|----------|
| Cognito JWKS signing keys | Production, Staging | AWS-managed (Cognito) | Automatic (AWS handles key rotation internally) |
| Stub RSA key pair | Development | Self-managed via Secrets Manager | Manual (see Category C rotation) |

Production and staging JWT verification uses the standard Cognito JWKS endpoint (`https://cognito-idp.eu-west-2.amazonaws.com/{poolId}/.well-known/jwks.json`). Cognito automatically rotates its signing keys; no action is required from Flex.

The development stub key pair is stored in Secrets Manager at `/development/flex-secret/auth/e2e/private_jwk` and served via a Lambda Function URL that mimics the Cognito JWKS endpoint.

### 1.6 Cognito App Client

| Credential | Type | Secret Required |
|------------|------|-----------------|
| Cognito App Client ID | Public client | No — uses PKCE (S256 code challenge) |

The Cognito app client is configured as a **public client** with no client secret. Authentication uses the Authorization Code flow with PKCE. The client ID is stored as a plain SSM parameter at `/${env}/flex-param/auth/client-id`.

The user pool and client are provisioned externally in the [`flex-params`](https://github.com/govuk-once/flex-params) repository, owned by the Platform team. Flex consumes these as read-only SSM parameters — any changes to the user pool or client configuration require coordination with the Platform team via `flex-params`.

### 1.7 API Certificates (ACM / CloudFront SSL)

| Certificate | Region | Validation | Cross-Account |
|-------------|--------|------------|---------------|
| FlexCert (ACM) | us-east-1 | DNS (Route 53 hosted zone) | No — same account |

A single ACM certificate is provisioned in `platform/infra/flex/src/stacks/global.ts` for the CloudFront distribution. It is DNS-validated against a hosted zone whose metadata is imported from SSM (`/infra/dns/hostedzoneid`, `/infra/dns/hostedzonename`). The hosted zone itself is managed by the Platform team; Flex owns the certificate resource and its CDK definition.

ACM certificates used with CloudFront are automatically renewed by AWS (up to 60 days before expiry) when DNS validation records remain in place. No manual rotation is required.

**TLS policies enforced:**
- CloudFront: `TLS_V1_2_2021` minimum protocol version
- API Gateway: `SecurityPolicy_TLS13_1_2_2021_06`

### 1.8 Pipeline Secrets (GitHub Actions)

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

### 1.9 Service-to-Service Authentication

| Pattern | Mechanism | Secret-Based |
|---------|-----------|--------------|
| CloudFront → API Gateway | Shared secret in `x-origin-verify` header, WAF-validated | Yes (covered in 1.1) |
| E2E tests → CloudFront WAF | Shared secret in `x-flex-e2e-bypass` header | Yes (covered in 1.1) |
| Internal Lambda → Private API Gateway | IAM SigV4 signing + VPC endpoint restriction | No |
| Cross-account external APIs (UDP, UNS) | STS AssumeRole + SigV4 signing + ExternalId | No |
| External API keys (DVLA, UNS) | API keys from Secrets Manager passed as headers | Yes (covered in 1.2) |
| UDP API keys | API keys from cross-account Secrets Manager | Yes (covered in 1.3) |
| Client → Public API | Cognito JWT verified by Lambda authorizer | No |
| Smoke test → Firebase | GCP Workload Identity Federation + App Check | No |
| mTLS | Not used | N/A |

Internal service-to-service communication is entirely IAM-based (SigV4 signed requests over VPC endpoints). No shared secrets exist between internal Flex services.

---

## 2. Rotation Policy

### Category DVLA — DVLA Consumer Config (Current: 60-day auto-rotation)

| Attribute | Value |
|-----------|-------|
| Secret | DVLA Consumer Config |
| Rotation interval | 60 days |
| Mechanism | Automatic (custom Lambda implementing the four-step Secrets Manager rotation protocol) |
| Owner | Flex team |
| Status | **Current — implemented and active** |
| Implementation | `platform/infra/flex/src/stacks/core/dvla-secret-rotation.ts` and `platform/domains/dvla-secret-rotation/` |

The rotation Lambda runs in a VPC with private egress (NAT for DVLA API access), with a 60-second timeout and 0 retry attempts. It performs four steps:
1. **createSecret** — generates a new password, calls the DVLA API to change it, requests a new API key, stores both under `AWSPENDING`. Uses an `AWSPENDING_CHECKPOINT` staging label for crash recovery.
2. **setSecret** — no-op (DVLA credentials are updated during createSecret).
3. **testSecret** — verifies the pending credentials by authenticating against the DVLA API.
4. **finishSecret** — promotes `AWSPENDING` to `AWSCURRENT`, cleans up checkpoint labels.

### Category A — Infrastructure Secrets (Proposed: 30-day auto-rotation)

| Attribute | Value |
|-----------|-------|
| Secrets | E2E Bypass Secret, Origin Verify Secret |
| Rotation interval | 30 days |
| Mechanism | Automatic (Secrets Manager rotation schedule with Lambda) |
| Owner | Flex team |
| Status | **Proposed — not yet implemented** |

**Rationale:** Self-generated random strings with no external dependency. Frequent rotation is low-risk and high-value — limits exposure window with no coordination overhead.

**Dependencies:** WAF rules and CloudFront custom headers contain values sourced from Secrets Manager during deployment, so a rotated value does not reach them until the stacks are redeployed. Rotation must update both the secret and any downstream consumers atomically. Cross-region replication propagates the new value automatically.

**Risks:** Transient mismatch during rotation window if a request arrives between secret update and replica propagation (mitigated by Secrets Manager's `AWSPENDING` / `AWSCURRENT` staging labels).

**Implementation path:** Add a CDK `SecretRotation` construct (or a `RotationSchedule` with `automaticallyAfterDays: 30`) using the `SecretsManagerRotationSingleUser` application. The rotation Lambda generates a new 32-character random string and updates `AWSCURRENT`. No external API calls required.

### Category B — UNS Consumer Config (Proposed: coordinated rotation, interval TBD)

| Attribute | Value |
|-----------|-------|
| Secret | UNS Consumer Config |
| Rotation interval | TBD — pending agreement with UNS team |
| Mechanism | Manual, coordinated with UNS team |
| Owner | UNS team (credential issuance) + Flex team (secret value update in Flex account) |
| Status | **Proposed — no rotation mechanism or cadence agreed** |

The UNS secret shell is in the Flex AWS account (created by `flex-params`) but the credential value is managed by the UNS team. Flex can monitor the secret's age via `ListSecretVersionIds` but cannot unilaterally rotate the value.

**Dependencies:** UNS team must issue new credentials. Downstream Lambdas cache the secret value for up to 600 seconds (10 minutes) via Powertools parameters `maxAge`. After the cache expires, the next invocation fetches the current value from Secrets Manager automatically — no deployment is needed.

**Risks:** Service disruption if the old credential is revoked before the 10-minute cache window expires on all warm Lambda containers. Mitigate by waiting at least 10 minutes after updating the secret before confirming old credential revocation.

**Requires agreement with UNS team on:** rotation cadence, notification process before/after rotation, and escalation path if credentials expire unexpectedly.

### Category C — Test and E2E Secrets (Proposed: manual rotation, interval TBD)

| Attribute | Value |
|-----------|-------|
| Secrets | E2E Private JWK, Smoke Test User, E2E Test User |
| Rotation interval | TBD — pending team agreement |
| Mechanism | Manual or script-assisted |
| Owner | Flex team |
| Status | **Proposed — no rotation schedule, scripts, or tracking in place** |

**Rationale:** Low-risk secrets used only in non-production test flows. Rotation must coordinate with CI/CD pipelines and test infrastructure to avoid breaking automated tests.

**Dependencies:** E2E test suites, smoke tests, and performance tests all consume these secrets at runtime. Rotation must be followed by verifying the full test suite passes.

**Risks:** Broken CI/CD pipelines if rotation is not coordinated with test infrastructure updates.

**Implementation path:**
1. Create a rotation script that generates new test credentials and updates the secret value.
2. For the private JWK: generate a new key pair, update the secret, and update any corresponding public key references.
3. Run the full E2E and smoke test suites to validate.

### Category D — Pipeline Secrets (Proposed: 180-day rotation)

| Attribute | Value |
|-----------|-------|
| Secrets | `SONAR_TOKEN_FLEX` |
| Rotation interval | 180 days |
| Mechanism | Manual — regenerate in SonarQube, update GitHub repository secret |
| Owner | Flex team |
| Status | **Proposed — no rotation tracking in place** |

**Rationale:** Only one true credential exists in the pipeline (`SONAR_TOKEN_FLEX`). All AWS access uses OIDC federation (keyless). Low rotation frequency acceptable given limited blast radius (code quality scanning, not production access).

**Risks:** Broken quality checks pipeline until the new token propagates. Schedule rotation during low-activity periods.

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

These credentials require no manual rotation. Only the ACM certificate is alerted on: its expiry alarm (see 5.2) catches a failed auto-renewal.

---

## 3. External Dependencies

Flex depends on credentials it does not own or cannot rotate. This section documents the monitoring backstops and required agreements for those dependencies.

### 3.1 UDP Consumer Config (Cross-Account)

| Attribute | Value |
|-----------|-------|
| Owner | UDP team |
| Secret location | UDP's AWS account (not accessible by Flex) |
| Flex's access | Cross-account IAM role assumption at runtime |
| Can Flex inspect rotation status? | **No** — `ListSecretVersionIds` / `DescribeSecret` will return `AccessDenied` |
| Monitoring backstop | API gateway 4xx error rate alarm — detects authentication failures reactively |

**Current gap:** Flex has no proactive visibility into the age or rotation status of this credential. If UDP lets the credential expire, Flex's only signal is service failure.

**Required agreement with UDP team:**
- Agreed rotation cadence
- Notification to Flex before and after credential rotation
- Escalation path and SLA for emergency reissuance if credentials break unexpectedly
- Consider: read-only cross-account access for Flex to check `LastRotatedDate`, or a shared health-check metric

### 3.2 UNS Consumer Config (Flex Account, Externally Managed Value)

| Attribute | Value |
|-----------|-------|
| Owner | UNS team (credential value), `flex-params` (secret resource) |
| Secret location | Flex AWS account |
| Flex's access | Full Secrets Manager read access |
| Can Flex inspect rotation status? | **Yes** — `ListSecretVersionIds` returns AWSCURRENT version age |
| Monitoring backstop | Credential monitor age check + API gateway 4xx error rate alarm |

**Current gap:** Flex can detect when the credential is ageing but cannot rotate it. An age alert requires escalation to the UNS team.

**Required agreement with UNS team:**
- Agreed rotation cadence
- Notification to Flex before and after credential rotation
- Escalation path and SLA for emergency reissuance
- Clear ownership of the rotation action

---

## 4. Rotation Procedures

### 4.1 Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| Flex Engineer (Executor) | Performs rotation for Flex-owned secrets (infrastructure, test/E2E, pipeline), verifies success, updates rotation log |
| Flex Lead (Approver) | Approves non-automated rotations for Flex-owned secrets, reviews rotation log, escalation point |
| Platform team | Owns Cognito user pool/client provisioning (via [`flex-params`](https://github.com/govuk-once/flex-params)), hosted zone DNS, and OIDC trust policies. Flex coordinates with Platform for changes to these resources |
| UNS team | Owns UNS credential value rotation. Notifies Flex before and after rotation |
| UDP team | Owns UDP credential and its rotation entirely. Notifies Flex before and after rotation |
| Security team | Consulted on exceptions, reviews quarterly rotation compliance report, audits IAM trust policies |

### 4.2 DVLA Consumer Config (Current — Automated)

**Who initiates:** Secrets Manager rotation schedule (automatic, every 60 days).

**Process:**
1. Secrets Manager invokes the rotation Lambda on the configured schedule.
2. Lambda generates a new password and calls the DVLA API to change it.
3. Lambda requests a new API key from the DVLA API.
4. Both values are stored under `AWSPENDING` (with checkpoint for crash recovery).
5. Lambda verifies the pending credentials by authenticating against the DVLA API.
6. On success, Lambda promotes `AWSPENDING` to `AWSCURRENT`.

**Verification:** The rotation Lambda's test step confirms the new value works before promotion. CloudWatch alarm fires on `RotationFailed` if any step fails.

**Rollback:** Secrets Manager retains the previous version as `AWSPREVIOUS`. If issues are detected post-rotation, manually promote `AWSPREVIOUS` back to `AWSCURRENT` via `aws secretsmanager update-secret-version-stage`.

**Human intervention required only on failure** (alert-triggered).

### 4.3 UNS Consumer Config (Proposed — Manual, Coordinated)

**Who initiates:** Flex Engineer, triggered by credential monitor age alert or calendar reminder.

**Process:**
1. Flex Engineer contacts the UNS team to request new credentials at least 5 business days before the rotation deadline.
2. UNS team issues new credentials and communicates them via secure channel.
3. Flex Engineer updates the secret value:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id <secret-arn> \
     --secret-string '<new-json-value>'
   ```
4. Wait at least 10 minutes for the Powertools in-memory cache (`maxAge: 600`) to expire on all warm Lambda containers. No deployment is required — Lambdas fetch the new value automatically on the next invocation after the cache expires.
5. Flex Engineer verifies API connectivity by checking CloudWatch error metrics and running smoke tests.
6. Flex Engineer confirms with UNS team that the old credential can be revoked.
7. UNS team revokes old credential.
8. Flex Engineer updates the rotation log with the date and next rotation due date.

**Approval:** Flex Lead must approve before step 3 (secret update in production).

**Rollback:** If the new credential fails verification before old credential revocation (step 7), revert to the previous value using `put-secret-value` with the old credentials. Lambdas will pick up the restored value within 10 minutes.

### 4.4 Category A — Infrastructure Secrets (Proposed — Automated)

**Status:** Not yet implemented. Process below describes the target state.

**Who initiates:** Secrets Manager rotation schedule (automatic).

**Process:**
1. Secrets Manager invokes the rotation Lambda on the configured schedule (every 30 days).
2. Lambda generates a new 32-character random string and stages it as `AWSPENDING`.
3. Lambda tests the new value (validates WAF rule or CloudFront header acceptance).
4. On success, Lambda promotes `AWSPENDING` to `AWSCURRENT`.
5. Cross-region replication propagates the new value automatically.

### 4.5 Category C — Test and E2E Secrets (Proposed — Manual/Scripted)

**Status:** Not yet implemented. No rotation scripts or tracking exist.

**Who initiates:** Flex Engineer, triggered by calendar reminder or expiry alert.

**Process:**
1. **E2E Private JWK:**
   - Generate a new RSA key pair.
   - Update the secret at `/development/flex-secret/auth/e2e/private_jwk` with the new private JWK.
   - The stub JWKS endpoint Lambda automatically serves the updated public key on next invocation.
   - Run E2E test suite against development to verify token signing works.

2. **Smoke Test User / E2E Test User:**
   - Coordinate with the identity provider (Cognito/OneLogin) to reset or regenerate test user credentials.
   - Update the secret at `/${env}/flex-secret/smoke-test/user` or `/${stage}/flex-secret/e2e/test_user`.
   - Run the full smoke test and E2E test suites to validate.

3. Update the rotation log with the date and next rotation due date.

### 4.6 Category D — Pipeline Secrets (Proposed — Manual)

**Status:** Not yet implemented. No rotation tracking exists.

**Who initiates:** Flex Engineer, triggered by calendar reminder (180-day cadence).

**Process:**
1. Generate a new token in SonarQube (Project Settings → Security → Tokens). Do not revoke the old token yet.
2. Update the `SONAR_TOKEN_FLEX` repository secret in GitHub (Settings → Secrets and variables → Actions).
3. Trigger a PR build (or re-run an existing workflow) to verify the new token authenticates successfully.
4. Confirm SonarQube analysis completes and results are uploaded.
5. Revoke the old token in SonarQube.
6. Update `pipeline-secrets-last-rotated.json` and the team calendar for the next rotation date.

### 4.7 Rotation Log

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

## 5. Expiry Alerting

Alerts are sent to the Slack alerting channel for the respective environment (`govuk-once-flex-alerting-dev`, `govuk-once-flex-alerting-staging`, `govuk-once-flex-alerting-production`) and are actioned by the Flex Engineer, with the Flex Lead as the escalation point.

### 5.1 Secrets Manager Rotation Monitoring

For all secrets with configured rotation schedules, alerts fire when rotation fails or a secret approaches its rotation deadline.

| Alert | Trigger | Channel | Severity | Status |
|-------|---------|---------|----------|--------|
| Rotation failure | Secrets Manager emits `RotationFailed` / `TestRotationFailed` CloudTrail event | EventBridge → SNS → team notification | Critical | **Current** (PR #551) |
| Rotation overdue | Secret's `LastRotatedDate` exceeds scheduled interval + 7-day grace | Credential monitor Lambda → CloudWatch custom metric → alarm | Medium | **Current** (PR #551) |
| Secret age exceeded | AWSCURRENT version age exceeds policy maximum | Credential monitor Lambda → CloudWatch custom metric → alarm | Medium | **Current** (PR #551) |

**Scope of credential monitor:** The credential monitor checks secrets in the Flex account only. UDP is excluded because its secret is cross-account and inaccessible.

### 5.2 ACM Certificate Expiry

| Alert | Trigger | Channel | Severity | Status |
|-------|---------|---------|----------|--------|
| Certificate approaching expiry | ACM `DaysToExpiry` metric < 45 days | CloudWatch Alarm → SNS | High | **Current** (PR #551) |

ACM auto-renews certificates 60 days before expiry when DNS validation is in place. The alert at 45 days catches cases where auto-renewal has failed (e.g., DNS validation records removed).

### 5.3 Pipeline Secret Expiry Reminders (Proposed)

| Alert | Trigger | Channel | Severity |
|-------|---------|---------|----------|
| SonarQube token rotation due | 180-day cadence timer | Calendar reminder + Slack notification | Medium |
| OIDC trust policy review due | Quarterly review cadence | Calendar reminder | Low |

Pipeline secrets do not have automated expiry detection (GitHub does not expose secret creation dates). Rotation tracking is maintained via:
- Team calendar entries at 180-day intervals for `SONAR_TOKEN_FLEX`
- A `pipeline-secrets-last-rotated.json` metadata file in the repository tracking rotation dates

### 5.4 External Credential Failure Detection

| Alert | Trigger | Channel | Severity | Status |
|-------|---------|---------|----------|--------|
| API authentication failure spike | 4xx error rate from external APIs exceeds threshold | CloudWatch Alarm on API error metrics | High | **Current** |

This is the only monitoring backstop for the UDP credential (cross-account, not directly inspectable). It also serves as a secondary signal for UNS and DVLA alongside proactive age monitoring.

---

## 6. Periodic Access Review Process (Proposed)

The following review processes are proposed. None are currently scheduled or tooled.

### 6.1 Schedule

| Review | Frequency | Owner | Participants |
|--------|-----------|-------|--------------|
| Secrets Manager access audit | Quarterly | Flex Lead | Flex team, Security |
| GitHub Actions secrets audit | Quarterly | Flex Lead | Flex team |
| IAM role trust policy review | Quarterly | Flex Lead | Flex team, Platform team, Security |
| Cognito / `flex-params` configuration review | Bi-annually | Platform team | Flex team (consulted) |
| External service credential audit | Bi-annually | Flex Lead | Flex team, UNS team, UDP team |
| Full credential inventory reconciliation | Annually | Flex Lead | Flex team, Platform team, Security, Engineering Lead |

### 6.2 Secrets Manager Access Review

**What:** Review which IAM roles and principals have access to each Flex secret.

**How:**
1. Generate IAM Access Analyzer findings for Secrets Manager resources.
2. Cross-reference `secretsmanager:GetSecretValue` grants against the expected consumer list per secret.
3. Verify that no unexpected principals have been granted access.
4. Check CloudTrail logs for `GetSecretValue` calls from unexpected sources.
5. Remove any stale or unnecessary access grants.

**Output:** Updated access matrix documenting which roles access which secrets, with justification.

### 6.3 GitHub Actions Secrets Review

**What:** Verify that all pipeline secrets are still required, correctly scoped, and recently rotated.

**How:**
1. List all repository and environment secrets in GitHub.
2. Cross-reference against workflow files — identify any secrets that are configured but unused.
3. Verify OIDC role trust policies restrict to expected repositories and branches.
4. Confirm `SONAR_TOKEN_FLEX` was rotated within the last 180 days.
5. Review workflow permissions — ensure minimal `permissions:` blocks are declared.
6. Audit action version pins — confirm all third-party actions use commit SHA pins.

**Output:** Confirmation that all secrets are active, scoped, and rotated; removal of any orphaned secrets.

### 6.4 IAM Role Trust Policy Review

**What:** Verify cross-account role assumptions and OIDC trust relationships are correctly scoped.

**Who:** Flex team leads the review; Platform team participates for trust policies they provision (OIDC roles, cross-account roles in external accounts).

**How:**
1. Review trust policies on deployment roles (`DEV_DEPLOYMENT_ROLE`, `STAGING_DEPLOYMENT_ROLE`, `PROD_DEPLOYMENT_ROLE`) — verify OIDC conditions restrict to the correct GitHub repository and branch patterns. (Platform team provisions these roles; Flex team verifies conditions are correct.)
2. Review trust policies on cross-account roles assumed for UDP/UNS — verify ExternalId conditions and source account restrictions.
3. Verify permissions boundaries on Lambda execution roles remain correctly scoped (Flex-owned CDK code).
4. Check that `execute-api:Invoke` grants on the private API gateway are limited to expected routes.

**Output:** Trust policy audit log with any deviations flagged for remediation. Platform team remediates trust policy changes in their accounts; Flex team remediates permissions boundaries and API gateway grants.

### 6.5 External Service Credential Audit

**What:** Confirm external credentials are still valid, minimally scoped, and documented.

**How:**
1. Confirm each external credential (DVLA, UDP, UNS) successfully authenticates (non-invasive health check).
2. Verify credential scope matches documented permissions (no privilege escalation since last review).
3. Confirm provider contact information is current for rotation coordination.
4. Review whether any providers now support automated key regeneration APIs.

**Output:** Provider contact list update, credential scope confirmation, and automation opportunity log.

---

## 7. Pipeline Secret Hygiene Review Process (Proposed)

### 7.1 Principles

- **Keyless by default:** All AWS access uses OIDC federation. No long-lived AWS credentials are stored.
- **Minimal stored secrets:** Only credentials that cannot use federated auth are stored (`SONAR_TOKEN_FLEX`).
- **Pin-to-SHA:** All third-party GitHub Actions are pinned to commit SHAs, not mutable tags.
- **Least privilege:** Workflow permissions are declared explicitly per job, not inherited from repository defaults.
- **No credential persistence:** All checkouts use `persist-credentials: false`.

### 7.2 Hygiene Checklist (Run Quarterly)

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

### 7.3 Ownership and Escalation

| Role | Responsibility |
|------|---------------|
| Flex team | Executes quarterly hygiene review, rotates pipeline secrets, maintains action pins, manages GitHub repository secrets |
| Platform team | Provisions and maintains OIDC deployment roles and their trust policies (consumed by Flex workflows) |
| Security team | Reviews OIDC trust policies, audits environment protection rules |
| Engineering Lead | Approves exceptions, escalation point for failed checks |

### 7.4 Remediation SLA

| Severity | Example | SLA |
|----------|---------|-----|
| Critical | Long-lived AWS credential found in GitHub | Immediate removal (< 1 hour), credential rotation, incident report |
| High | OIDC trust policy too permissive | 1 business day |
| Medium | Action pinned to tag instead of SHA | 5 business days |
| Low | Orphaned secret (configured but unused) | Next quarterly review |

---

## 8. Identified Risks and Gaps

| Item | Risk | Mitigation | Review Date |
|------|------|------------|-------------|
| E2E Bypass / Origin Verify have no rotation | Compromised value remains valid indefinitely | Proposed: 30-day auto-rotation (Category A). Until implemented, these are static secrets with no expiry | TBD |
| UDP credential is not inspectable | Flex cannot detect ageing or failed rotation proactively | 4xx error rate alarm is the only backstop. Requires agreement with UDP team on rotation notification | TBD |
| UNS credential rotation is not Flex-controlled | Age alert fires but Flex cannot action it alone | Requires agreement with UNS team on rotation cadence and escalation path | TBD |
| Test/E2E secrets have no rotation schedule | Low risk (non-production) but no rotation interval agreed | Proposed: manual rotation with calendar tracking (Category C), interval TBD | TBD |
| `SONAR_TOKEN_FLEX` has no rotation tracking | Token may age beyond 180-day target undetected | Proposed: `pipeline-secrets-last-rotated.json` + calendar reminders (Category D) | TBD |
| E2E Private JWK | Development-only signing key with no production exposure. Auto-rotation would require synchronising public/private key pairs across test infrastructure, adding complexity disproportionate to the risk | Accept manual rotation | TBD |
| Periodic access reviews not yet scheduled | No regular audit of who can access what | Proposed: quarterly review cadence (Section 6) | TBD |
| Orphaned secrets in dev account | Leftover PR-environment and personal dev secrets accumulate | Requires cleanup and a process to prevent recurrence | TBD |

All accepted risks should be assigned review dates once the team agrees on the target state and timelines.

---

## 9. Rotation Cadence Summary

| Credential Type | Cadence | Mechanism | Owner | Status |
|-----------------|---------|-----------|-------|--------|
| DVLA consumer config | 60 days | Automatic (custom Lambda) | Flex team | **Current** |
| Infrastructure secrets (WAF) | 30 days | Automatic (Secrets Manager + Lambda) | Flex team | **Proposed** |
| UNS consumer config | TBD | Manual (coordinated with UNS team) | UNS team + Flex team | **Proposed** |
| UDP consumer config | Unknown | Entirely external | UDP team | **Not Flex-controlled** |
| Test/E2E secrets | TBD | Manual/scripted | Flex team | **Proposed** |
| Pipeline secrets (SonarQube) | 180 days | Manual (regenerate + update GitHub) | Flex team | **Proposed** |
| Cognito user pool / client | N/A | Provisioned via `flex-params` | Platform team | N/A |
| Cognito JWT keys | Continuous | AWS-managed | AWS (via Platform team's Cognito setup) | **Current** |
| ACM certificates | Auto-renewed | AWS-managed (DNS validation) | Flex team (CDK definition) / AWS (renewal) | **Current** |
| OIDC deployment roles | N/A | Trust policies managed externally | Platform team | N/A |
| IAM/STS credentials | Per-request | AWS-managed | AWS | **Current** |
| GitHub OIDC tokens | Per-workflow | GitHub-managed | GitHub | **Current** |

---

## Related

- [`flex-params`](https://github.com/govuk-once/flex-params) — Platform team repository provisioning Cognito user pools, app clients, and external SSM parameters consumed by Flex
- [Leaked Secret Runbook](/docs/runbooks/leaked-secret.md) — incident response and manual rotation procedure
- [AWS Secrets Manager rotation documentation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
- [`platform/infra/flex/src/stacks/global.ts`](/platform/infra/flex/src/stacks/global.ts) — E2E Bypass Secret and CloudFront distribution
- [`platform/infra/flex/src/stacks/platform.ts`](/platform/infra/flex/src/stacks/platform.ts) — Origin Verify Secret and WAF rules
- [`platform/infra/flex/src/stacks/core/dvla-secret-rotation.ts`](/platform/infra/flex/src/stacks/core/dvla-secret-rotation.ts) — DVLA rotation Lambda infrastructure
- [`platform/domains/dvla-secret-rotation/`](/platform/domains/dvla-secret-rotation/) — DVLA rotation Lambda handler
- [`platform/domains/dvla/gateway.config.ts`](/platform/domains/dvla/gateway.config.ts) — DVLA secret reference
- [`platform/domains/udp/gateway.config.ts`](/platform/domains/udp/gateway.config.ts) — UDP secret reference
- [`platform/domains/uns/gateway.config.ts`](/platform/domains/uns/gateway.config.ts) — UNS secret reference
- [`.github/workflows/`](/.github/workflows/) — Pipeline workflow definitions
