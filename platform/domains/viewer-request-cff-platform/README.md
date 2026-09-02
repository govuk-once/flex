# @platform/viewer-request-cff-platform

CloudFront Function that validates incoming requests before they reach the origin and ensures every request carries a correlation id. Implemented in [`src/handler.ts`](/platform/domains/viewer-request-cff-platform/src/handler.ts), tested in [`src/handler.test.ts`](/platform/domains/viewer-request-cff-platform/src/handler.test.ts).

---

## Commands

Run these from the repository root:

| Command                                           | Description    |
| ------------------------------------------------- | -------------- |
| `pnpm --filter @platform/viewer-request-cff lint` | Lint files     |
| `pnpm --filter @platform/viewer-request-cff test` | Run tests      |
| `pnpm --filter @platform/viewer-request-cff tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `platform/domains/viewer-request-cff-platform/`.

---

## Handler

| Property | Value                          |
| -------- | ------------------------------ |
| Type     | CloudFront Function            |
| Trigger  | Viewer request (before origin) |

### Behaviour

1. Reads `x-correlation-id` from the incoming request. If it's missing or not a valid UUIDv4, a new one is derived from `event.context.requestId` and written back onto the request headers.
2. Verifies the `Authorization` header is present and is a valid Bearer token.
3. Validates the extracted token's structure: three base64 segments, header and body must decode as JSON, and `alg: "none"` is explicitly rejected.
4. Forwards the request to the origin if all checks pass.

Structural only: the function does not verify a signature, that is the authorizer's responsibility (see [@platform/auth](/platform/domains/auth/README.md)).

### Rejection

Any validation failure returns, from [`src/responses/unathorized.ts`](/platform/domains/viewer-request-cff-platform/src/responses/unathorized.ts):

| Property | Value                                |
| -------- | ------------------------------------ |
| Status   | `401`                                |
| Body     | `{ "message": "Unauthorized" }`      |
| Header   | `X-Rejected-By: cloudfront-function` |

### Telemetry

Emits `CffTelemetryEvent` events based on the outcome, via `@flex/telemetry/cff`:

- `cff_token_validated`: on pass-through
- `cff_token_missing`: when the `Authorization` header or token is absent
- `cff_token_invalid`: Any other structural failure

Every event includes the correlation ID while failures also carry the rejection reason.

---

## Related

**FLEX:**

- [@flex/telemetry](/libs/telemetry/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/auth](/platform/domains/auth/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
