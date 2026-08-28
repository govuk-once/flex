# Credential Lifecycle Architecture

Architecture diagrams for FLEX-404 implementation review.

---

## 1. Alerting Topology

Three monitoring mechanisms in eu-west-2 plus rotation and ACM alerting in us-east-1, all funnelling through the existing SNS → Chatbot → Slack pipeline.

```mermaid
flowchart LR
    subgraph eu-west-2
        RL1[Rotation Lambda<br><i>Origin Verify 30d</i>]
        EM[Expiry Monitor Lambda<br><i>All Flex secrets · daily</i>]
        DC[Drift Check Lambda<br><i>Cognito SSM params · 6h</i>]

        EB1[EventBridge<br>rotation events]
        CW1[CloudWatch<br>SecretOverdue]
        CW2[CloudWatch<br>CognitoDrift]

        CRIT[SNS Critical<br><code>flex-alerts-critical</code>]
        WARN[SNS Warning<br><code>flex-alerts-warning</code>]
        SLACK[AWS Chatbot → Slack]

        RL1 -->|emits events| EB1
        EM -->|publishes metric| CW1
        DC -->|publishes metric| CW2

        EB1 -->|fail| CRIT
        EB1 -->|success| WARN
        CW1 -->|overdue alarm| WARN
        CW2 -->|drift alarm| CRIT

        CRIT --> SLACK
        WARN --> SLACK
    end

    subgraph us-east-1
        RL2[Rotation Lambda<br><i>E2E Bypass 30d</i>]
        ACM[ACM Expiry Alarm<br><code>DaysToExpiry < 45</code>]
        EB2[EventBridge<br>rotation events]
        RELAY[SNS Relay Topics<br>+ Relay Lambda]

        RL2 -->|emits events| EB2
        EB2 --> RELAY
        ACM --> RELAY
    end

    RELAY -->|cross-region relay| CRIT
    RELAY -->|cross-region relay| WARN
```

### Alert severity mapping

| Severity | Triggers |
|----------|----------|
| **CRITICAL** | Rotation failure, Cognito drift detected |
| **WARNING** | Rotation success (deploy needed), secret overdue, ACM < 45 days |

---

## 2. Secret Rotation Protocol

Both infrastructure secrets (Origin Verify, E2E Bypass) use the same 4-step Secrets Manager rotation protocol. `setSecret` is a no-op because WAF rules and CloudFront headers resolve `secretValue.unsafeUnwrap()` at deploy time, not runtime.

```mermaid
flowchart LR
    SM[Secrets Manager<br><i>schedule: 30 days</i>] --> S1

    S1["<b>1. createSecret</b><br>Generate 32-char random<br>Store as AWSPENDING"]
    S1 --> S2["<b>2. setSecret</b><br>No-op<br><i>infra updates via deploy</i>"]
    S2 --> S3["<b>3. testSecret</b><br>GetSecretValue with<br>AWSPENDING stage"]
    S3 --> S4["<b>4. finishSecret</b><br>Promote AWSPENDING<br>→ AWSCURRENT"]

    S4 -.->|notify team| DEPLOY[CDK Deploy]
    DEPLOY --> WAF[WAF byte match rule]
    DEPLOY --> CF[CloudFront origin header]

    style S1 fill:#e8f0fe,stroke:#4285f4,color:#1a1a2e
    style S4 fill:#e6f4ea,stroke:#34a853,color:#1a1a2e
    style S2 fill:#f5f5f5,stroke:#bbb,color:#666
```

> **Why setSecret is a no-op:** WAF rules and CloudFront custom headers resolve `secretValue.unsafeUnwrap()` at CDK synth time. The value is baked into the CloudFormation template. Rotating the secret in Secrets Manager updates `AWSCURRENT`, but the infrastructure still serves the old value until the next deployment.

---

## 3. Cognito Config Drift Detection

If Platform team updates Cognito config in `flex-params` but Flex hasn't deployed, the authorizer Lambda runs with stale values. The drift check catches this within 6 hours — before users hit auth failures.

```mermaid
flowchart LR
    FP[flex-params repo<br><i>Platform team writes<br>Cognito config</i>] -->|writes| SSM

    SSM["SSM Parameter Store<br><code>auth/user-pool-id</code><br><code>auth/client-id</code><br><code>auth/stub/* (dev)</code>"]

    SSM -->|"reads (current truth)"| DRIFT

    DRIFT["Drift Check Lambda<br><i>EventBridge: rate(6h)</i>"]

    AUTH["Authorizer Lambda<br><code>env: USERPOOL_ID, CLIENT_ID</code><br><i>baked at last deploy</i>"]

    DRIFT -->|GetFunctionConfiguration| AUTH

    DRIFT -->|match| OK["✓ In sync"]
    DRIFT -->|mismatch| ALERT["✗ Drift detected"]
    ALERT --> SNS["SNS Critical → Slack<br><i>Deploy to activate<br>new Cognito config</i>"]

    style DRIFT fill:#fce8e6,stroke:#ea4335,color:#1a1a2e
    style ALERT fill:#fce8e6,stroke:#ea4335,color:#1a1a2e
    style OK fill:#e6f4ea,stroke:#34a853,color:#1a1a2e
```

---

## 4. Authoriser Token Revocation Flow

The authoriser validates JWT signature and claims via `aws-jwt-verify`, then verifies the token has not been revoked by calling the Cognito `userInfo` endpoint. A short-lived in-memory cache (30s TTL, keyed by `jti`) avoids calling Cognito on every request for the same token.

```mermaid
flowchart LR
    REQ[Incoming request<br><i>Bearer JWT</i>] --> SIG["Signature + claims check<br><code>aws-jwt-verify</code>"]
    SIG -->|invalid| DENY1[Deny 401]
    SIG -->|valid| CACHE{jti in<br>revocation cache?}
    CACHE -->|"hit (< 30s)"| ALLOW[Allow]
    CACHE -->|miss| UINFO["Cognito userInfo endpoint<br><code>Bearer {token}</code>"]
    UINFO -->|200 OK| CACHEWRITE["Cache jti → valid (30s)"] --> ALLOW
    UINFO -->|401| DENY2["Deny 401<br><i>token revoked</i>"]
    UINFO -->|unreachable| DENY3["Deny 401<br><i>fail closed</i>"]

    style UINFO fill:#e8f0fe,stroke:#4285f4,color:#1a1a2e
    style DENY2 fill:#fce8e6,stroke:#ea4335,color:#1a1a2e
    style DENY3 fill:#fce8e6,stroke:#ea4335,color:#1a1a2e
    style ALLOW fill:#e6f4ea,stroke:#34a853,color:#1a1a2e
```

When `GlobalSignOut` or `RevokeToken` is called in Cognito during incident response, the authoriser rejects the revoked token within at most 30 seconds (cache expiry).

---

## 5. Credential Coverage Matrix

Every credential type from the AC, showing which lifecycle mechanism covers it.

| Credential | Auto-rotate | Expiry alert | Drift detect | Revocation | Mechanism |
|------------|:-----------:|:------------:|:------------:|:----------:|-----------|
| Origin Verify Secret | ✅ | ✅ | — | — | Rotation Lambda 30d + EventBridge fail alert |
| E2E Bypass Secret | ✅ | ✅ | — | — | Rotation Lambda 30d + EventBridge fail alert |
| DVLA / UDP / UNS configs | — | ✅ | — | — | Expiry monitor checks `LastRotatedDate` (90d) |
| E2E / Smoke test secrets | — | ✅ | — | — | Expiry monitor checks `LastRotatedDate` (90d) |
| Cognito JWT keys | ✅ | ✅ | — | — | AWS auto-rotates; `aws-jwt-verify` refetches on `kid` miss |
| Cognito access tokens | — | — | — | ✅ | Authoriser checks Cognito `userInfo` on each request (30s cache) |
| Cognito User Pool / Client ID | — | — | ✅ | — | Drift check: SSM vs deployed env vars every 6h |
| ACM certificate | ✅ | ✅ | — | — | AWS auto-renews; CW alarm on `DaysToExpiry < 45` |
| SONAR_TOKEN_FLEX | — | ⚠️ | — | — | Calendar reminder (180d); no API for auto-detection |
| OIDC roles / STS / GITHUB_TOKEN | ✅ | — | — | — | Short-lived / per-request — no monitoring needed |

**Legend:** ✅ Covered (automated) · ⚠️ Covered (manual tracking) · — Not applicable

---

## Implementation Components

| Component | New/Modify | Region | Purpose |
|-----------|-----------|--------|---------|
| Rotation Lambda | New | eu-west-2 + us-east-1 | 4-step rotation for random-string secrets |
| Expiry Monitor Lambda | New | eu-west-2 | Daily `LastRotatedDate` check on all Flex secrets |
| Drift Check Lambda | New | eu-west-2 | 6-hourly SSM vs authoriser env var comparison |
| Token revocation check | Modify auth-service.ts | eu-west-2 | Cognito userInfo check + 30s revocation cache |
| `SecretRotationAlarms` construct | New | Both | EventBridge rules for rotation success/failure |
| ACM expiry alarm | Modify global.ts | us-east-1 | CloudWatch `DaysToExpiry < 45` |
| Rotation schedules | Modify platform.ts + global.ts | Both | `addRotationSchedule` on infrastructure secrets |
