# @platform/auth

Lambda authorizer for API Gateway that verifies Cognito JWT tokens and provides user identity to downstream handlers.

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

**Reject (401 Unauthorized):**

- Missing `Authorization` header
- JWT is either empty, invalid or expired
- Missing `username` claim in token

### Configuration

| Environment Variable     | Description                                 |
| ------------------------ | ------------------------------------------- |
| `AWS_REGION`             | AWS region for Cognito                      |
| `USERPOOL_ID_PARAM_NAME` | SSM parameter name for Cognito User Pool ID |
| `CLIENT_ID_PARAM_NAME`   | SSM parameter name for Cognito Client ID    |

> `getConfig` strips the `_PARAM_NAME` suffix from environment variable names, so `API_KEY_PARAM_NAME` becomes `config.API_KEY` in handler code.

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/middlewares](/libs/middlewares/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
