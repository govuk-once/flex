# DVLA and UNS error response migration

Status: **Phase 1 (dual-emit) in progress**

## Summary

FLEX error responses are being consolidated onto a single, flat JSON shape. As
part of that, DVLA and UNS errors that previously nested their payload under a
top-level `error` key now expose those fields at the top level as well. To avoid
breaking anyone, the legacy `error` field is still emitted during a transition
window. It is deprecated and will be removed in a follow-up.

If you consume DVLA or UNS error responses, please move to the flat fields
before Phase 2.

## Who this affects

- **Affected:** any consumer that reads fields nested under `error`, i.e.
  `body.error.code` / `body.error.message` (DVLA) or `body.error.detail` (UNS).
- **Not affected:** consumers that only read `body.message` or the HTTP status
  code. Those are unchanged.

If you are not sure whether you read the nested fields, search your client for
`.error.` access on DVLA/UNS responses.

## The flat contract

Every FLEX error now uses one shape:

```jsonc
{
  "message": "string",            // always present, human readable
  "type": "auth_error | validation_error | client_error | server_error",
  "errors": [                     // optional, field-level validation only
    { "field": "query.page", "message": "Expected number" }
  ]
}
```

Domain-specific fields (such as DVLA's provider `code`) sit alongside these at
the top level.

See the canonical contract in
[`libs/sdk/README.md`](/libs/sdk/README.md#error-response-contract).

## Before and after

### DVLA (e.g. `GET /v1/customer/licence`, provider not-found)

```jsonc
// BEFORE (legacy)
{ "error": { "code": "GUK-404-01", "message": "Linking ID no longer valid" } }

// PHASE 1 - now (both shapes emitted)
{
  "code": "GUK-404-01",
  "message": "Linking ID no longer valid",
  "type": "client_error",
  "error": { "code": "GUK-404-01", "message": "Linking ID no longer valid" } // deprecated
}

// PHASE 2 - final (legacy removed)
{ "code": "GUK-404-01", "message": "Linking ID no longer valid", "type": "client_error" }
```

### UNS (relayed upstream client error)

```jsonc
// BEFORE (legacy)
{ "message": "Bad Request", "error": { "detail": "invalid externalUserID" } }

// PHASE 1 - now (both shapes emitted)
{
  "detail": "invalid externalUserID",
  "message": "Bad Request",
  "type": "client_error",
  "error": { "detail": "invalid externalUserID" } // deprecated
}

// PHASE 2 - final (legacy removed)
{ "detail": "invalid externalUserID", "message": "Bad Request", "type": "client_error" }
```

## What you need to do

Read the flat fields, not the nested `error` object:

```diff
- const code = body.error?.code;
- const detail = body.error?.detail;
+ const code = body.code;
+ const detail = body.detail;
```

`body.message` and the HTTP status code are unchanged, so if that is all you use,
no change is needed.

## Timeline

| Phase | What | When |
| --- | --- | --- |
| Phase 1 | Both shapes emitted (flat + legacy `error`). Consumers migrate. | Now |
| Phase 2 | Legacy `error` field removed. Only the flat shape remains. | After consumer sign-off |

## Consumer sign-off

Phase 2 will not ship until affected consumers have confirmed migration.
Tracing the consumer set and collecting that sign-off is tracked in Jira.

If your service consumes DVLA or UNS and you read the nested `error` fields,
please let the FLEX platform team know so we can track your migration before
Phase 2.

## Related change: error bodies where there were none

Domain endpoints that fail by throwing an `http-errors` error (for example an
upstream failure surfacing as a 502) previously returned the status code with an
**empty body**. They now return the same shape as every other error:

```jsonc
// BEFORE: 502 with body ""

// NOW
{ "message": "Internal server error", "type": "server_error" }
```

This is additive. No field is removed or renamed, and a client that reads only
the status code is unaffected. Messages for 5xx stay deliberately generic: the
detail is logged, not exposed.

## Related change: authentication error messages

Separately, the CloudFront Function and the Lambda authorizer now return a
constant `{ "message": "Unauthorized", "type": "auth_error" }` for every
authentication failure, regardless of reason. Previously an expired token
produced a distinct "JWT expired" message. Do not rely on the message text to
determine why authentication failed; use the HTTP status code (401 or 403).
