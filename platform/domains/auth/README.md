# @platform/auth

Lambda authorizer for API Gateway that verifies Cognito access tokens and provides user identity to downstream handlers.

This workspace also defines a JWKS endpoint which is used for E2E testing purposes only.

---

## Commands

Run these from the repository root:

| Command                             | Description    |
| ----------------------------------- | -------------- |
| `pnpm --filter @platform/auth lint` | Lint files     |
| `pnpm --filter @platform/auth test` | Run tests      |
| `pnpm --filter @platform/auth tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `platform/domains/auth/`.

---

## Handler

| Property | Value                                |
| -------- | ------------------------------------ |
| Type     | Lambda Authorizer                    |
| Trigger  | All authenticated API Gateway routes |

### Behaviour

The authorizer validates Cognito access tokens and extracts user identity:

1. Extracts JWT from the `Authorization` header
2. Verifies the token using `CognitoJwtVerifier` with configured User Pool and Client ID
3. Extracts `pairwiseId` from the decoded token's `username` claim
4. Returns an IAM Allow policy with `pairwiseId` attached to the authorizer context

### Configuration

| Environment Variable | Description                                   |
| -------------------- | --------------------------------------------- |
| `AWS_REGION`         | AWS region for the Cognito issuer URL         |
| `USERPOOL_ID`        | Cognito User Pool ID                          |
| `CLIENT_ID`          | Cognito App Client ID                         |
| `JWKS_URI`           | JWKS endpoint used to verify token signatures |

### Telemetry

Emits one `TelemetryEvent` per outcome:

- `auth_success`
- `auth_token_expired`
- `auth_token_missing`
- `auth_claim_missing`
- `auth_token_invalid`
- `auth_failure`

Failure events assign an error message to the `reason` field.

---

## JWKS Endpoint

| Property | Value                      |
| -------- | -------------------------- |
| Type     | Lambda (API Gateway proxy) |
| Trigger  | HTTP GET                   |

Serves a JSON Web Key Set built from a single RSA public key held in Secrets Manager, useful for E2E tests as it can mint tokens the authorizer will accept.

---

## Related

**FLEX:**

- [@flex/logging](/libs/logging/README.md)
- [@flex/sdk](/libs/sdk/README.md)
- [@flex/telemetry](/libs/telemetry/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
