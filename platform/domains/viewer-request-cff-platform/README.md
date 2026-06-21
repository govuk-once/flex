# @platform/viewer-request-cff

CloudFront Function that performs several functions:

- Structural validation on incoming requests before they reach the origin
- Applies a secret header that can be verified at the API Gateway

---

## Commands

Run these from the repository root:

| Command                                           | Description    |
| ------------------------------------------------- | -------------- |
| `pnpm --filter @platform/viewer-request-cff lint` | Lint files     |
| `pnpm --filter @platform/viewer-request-cff test` | Run tests      |
| `pnpm --filter @platform/viewer-request-cff tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `platform/domains/viewer-request-cff/`.

---

## Handler

| Property | Value                          |
| -------- | ------------------------------ |
| Type     | CloudFront Function            |
| Trigger  | Viewer request (before origin) |

### Behaviour

The function performs the following before forwarding to the origin:

1. Checks for `Authorization` header presence
2. Extracts Bearer token from the header and validates the structure
3. Applies the secret header for the gateway to verify
4. Passes request through to origin if all checks pass.

**Reject (401 Unauthorized):**

- Missing `Authorization` header: `"Unauthorized: no authorization header provided"`
- Missing Bearer token: `"Unauthorized: structural check failed"`

Rejected responses include the `X-Rejected-By: cloudfront-function` header.

---

## Related

**FLEX:**

- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
