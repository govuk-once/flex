# Secrets Manager Auto-Rotation Policy

## SecurityHub Finding

| Field | Value |
|-------|-------|
| Control | `SecretsManager.1` — Secrets Manager secrets should have automatic rotation enabled |
| Severity | Medium |
| Affected resources | All Secrets Manager secrets across all stages |
| Date identified | 2026-08-24 |

Secrets that remain unchanged for long periods increase the impact of accidental disclosure or unauthorised access. Auto-rotation limits the window during which a compromised credential remains valid.

---

## Secrets Inventory

All secrets below are failing the `SecretsManager.1` control (no rotation configured).

### Category A — Infrastructure Secrets

Self-generated random strings created and managed in this repository's CDK code. No external dependency; values can be rotated freely without third-party coordination.

| Secret | Path | Purpose | Created In |
|--------|------|---------|------------|
| E2E Bypass Secret | `/${stage}/flex-secret/waf/e2e-bypass` | WAF bypass header value for E2E tests | `platform/infra/flex/src/stacks/global.ts` |
| Origin Verify Secret | `/${stage}/flex-secret/origin-verify-secret` | CloudFront-to-API Gateway origin verification header | `platform/infra/flex/src/stacks/platform.ts` |

Both secrets are 32-character random strings (no punctuation) and are replicated cross-region (E2E Bypass to `eu-west-2`, Origin Verify to `us-east-1`).

### Category B — External Service Credentials

API credentials for third-party services, stored in Secrets Manager but managed outside this repository. The ARN is referenced via SSM Parameter Store; the secret value is provisioned externally.

| Secret | SSM Pointer Path | Purpose | Fields |
|--------|-----------------|---------|--------|
| DVLA Consumer Config | `/dvla/consumer-config-secret-arn` | DVLA API authentication | apiKey, apiUrl, apiUsername, apiPassword, wellKnownJwkUrl |
| UDP Consumer Config | `/udp/consumer-config-secret-arn` | UDP API authentication | apiAccountId, apiKey, apiUrl, consumerRoleArn, region, externalId |
| UNS Consumer Config | `/uns/consumer-config-secret` | UNS API authentication | apiKey, apiUrl, privateApiUrl, region, roleArn |

### Category C — Test and E2E Secrets

Credentials used exclusively for automated testing. Not present in production traffic paths.

| Secret | Path | Purpose | Stages |
|--------|------|---------|--------|
| E2E Private JWK | `/development/flex-secret/auth/e2e/private_jwk` | Private key for stub token signing | Development only |
| Smoke Test User | `/${env}/flex-secret/smoke-test/user` | Smoke test user credentials | All environments |
| E2E Test User | `/${stage}/flex-secret/e2e/test_user` | E2E test user credentials | Staging, Production |

---

## Rotation Policy

### Category A — Infrastructure Secrets

| Attribute | Value |
|-----------|-------|
| Rotation interval | 30 days |
| Mechanism | Automatic (Secrets Manager rotation schedule with Lambda) |
| Owner | Platform team |
| Rationale | Self-generated random strings with no external dependency. Frequent rotation is low-risk and high-value — limits exposure window with no coordination overhead. |
| Dependencies | WAF rules and CloudFront custom headers reference the current secret value at runtime. Rotation Lambda must update both the secret and any downstream consumers atomically. Cross-region replication propagates the new value automatically. |
| Risks | Transient mismatch during rotation window if a request arrives between secret update and replica propagation (mitigated by Secrets Manager's `AWSPENDING` / `AWSCURRENT` staging labels). |

**Implementation path:** Add a CDK `SecretRotation` construct (or a `RotationSchedule` with `automaticallyAfterDays: 30`) using the `SecretsManagerRotationSingleUser` application. The rotation Lambda generates a new 32-character random string and updates `AWSCURRENT`. No external API calls required.

### Category B — External Service Credentials

| Attribute | Value |
|-----------|-------|
| Rotation interval | 90 days (or per provider contract, whichever is shorter) |
| Mechanism | Manual, coordinated with external service provider |
| Owner | Platform team (rotation execution) + external provider (new credential issuance) |
| Rationale | These credentials authenticate against third-party APIs (DVLA, UDP, UNS). Rotation requires the provider to issue a new key/password and FLEX to update the stored value. Unilateral rotation would break authentication. |
| Dependencies | Provider must support credential regeneration. Downstream Lambdas cache the secret value for up to 600 seconds (`maxAge` in Powertools parameters). A redeploy forces cold starts to pick up the new value immediately. |
| Risks | Service disruption if the old credential is revoked before the new value propagates to all warm Lambda containers. Mitigate by deploying immediately after updating the secret. |

**Implementation path:**
1. Establish rotation calendar (90-day cadence) with alerts via team calendar or automated reminder.
2. Follow the rotation steps in the [Leaked Secret Runbook](/docs/runbooks/leaked-secret.md#rotating-and-redeploying-affected-services) — the same `put-secret-value` + redeploy process applies to planned rotation.
3. Long-term: if the provider offers an API for key regeneration, implement a custom rotation Lambda that automates the full cycle.

### Category C — Test and E2E Secrets

| Attribute | Value |
|-----------|-------|
| Rotation interval | 90 days |
| Mechanism | Manual or script-assisted |
| Owner | Platform team |
| Rationale | Low-risk secrets used only in non-production test flows. Rotation must coordinate with CI/CD pipelines and test infrastructure to avoid breaking automated tests. |
| Dependencies | E2E test suites, smoke tests, and performance tests all consume these secrets at runtime. Rotation must be followed by verifying the full test suite passes. |
| Risks | Broken CI/CD pipelines if rotation is not coordinated with test infrastructure updates. |

**Implementation path:**
1. Create a rotation script that generates new test credentials and updates the secret value.
2. For the private JWK: generate a new key pair, update the secret, and update any corresponding public key references.
3. Run the full E2E and smoke test suites to validate.

---

## Exceptions and Accepted Risks

| Secret | Exception | Justification | Review Date |
|--------|-----------|---------------|-------------|
| E2E Private JWK (`/development/...`) | Accept 90-day manual rotation instead of auto-rotation | Development-only signing key with no production exposure. Auto-rotation would require synchronising public/private key pairs across test infrastructure, adding complexity disproportionate to the risk. | 2027-02-24 |
| Smoke Test User | Accept 90-day manual rotation instead of auto-rotation | Test user credentials managed in conjunction with the identity provider's test environment. Auto-rotation depends on the provider supporting programmatic user credential updates. | 2027-02-24 |
| E2E Test User | Accept 90-day manual rotation instead of auto-rotation | Same rationale as Smoke Test User — credentials are tied to test identity provider configuration. | 2027-02-24 |
| External credentials (DVLA, UDP, UNS) | Accept 90-day manual rotation instead of auto-rotation | Rotation requires bilateral coordination with external providers who do not currently offer automated key regeneration APIs. | 2027-02-24 |

All exceptions should be reviewed at or before their review date to assess whether automation has become feasible.

---

## Related

- [Leaked Secret Runbook](/docs/runbooks/leaked-secret.md) — incident response and manual rotation procedure
- [AWS Secrets Manager rotation documentation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
- [`platform/infra/flex/src/stacks/global.ts`](/platform/infra/flex/src/stacks/global.ts) — E2E Bypass Secret definition
- [`platform/infra/flex/src/stacks/platform.ts`](/platform/infra/flex/src/stacks/platform.ts) — Origin Verify Secret definition
- [`platform/domains/dvla/gateway.config.ts`](/platform/domains/dvla/gateway.config.ts) — DVLA secret reference
- [`platform/domains/udp/gateway.config.ts`](/platform/domains/udp/gateway.config.ts) — UDP secret reference
- [`platform/domains/uns/gateway.config.ts`](/platform/domains/uns/gateway.config.ts) — UNS secret reference
