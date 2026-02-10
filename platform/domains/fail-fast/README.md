# @platform/fail-fast

CloudFront Function that performs structural validation on incoming requests before they reach the origin.

---

## Commands

Run these from the repository root:

| Command                                  | Description    |
| ---------------------------------------- | -------------- |
| `pnpm --filter @platform/fail-fast lint` | Lint files     |
| `pnpm --filter @platform/fail-fast test` | Run tests      |
| `pnpm --filter @platform/fail-fast tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `platform/domains/fail-fast/`.

---

## Handler

| Property | Value                          |
| -------- | ------------------------------ |
| Type     | CloudFront Function            |
| Trigger  | Viewer request (before origin) |

### Behaviour

The function validates request structure at the edge before forwarding to the origin:

1. Checks for `Authorization` header presence
2. Extracts Bearer token from the header
3. Passes request through to origin if valid

**Reject (401 Unauthorized):**

- Missing `Authorization` header: `"Unauthorized: no authorization header provided"`
- Missing Bearer token: `"Unauthorized: structural check failed"`

Rejected responses include the `X-Rejected-By: cloudfront-function` header.

> This function performs structural validation only. JWT signature verification happens in the Lambda authorizer.

---

## Related

**FLEX:**

- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
