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
| Phase 2 | Legacy `error` field removed. Only the flat shape remains. | _TODO: date_ |

Phase 2 will not ship until affected consumers have confirmed migration (see
sign-off below).

## Consumer tracing and sign-off

We are confirming the consumer set before removing the legacy field.

- [ ] Internal FLEX code searched for `.error.(code|message|detail)` reads.
- [ ] API Gateway access logs reviewed for callers of DVLA/UNS error paths.
- [ ] GOV.UK App team confirmed whether the app reads DVLA provider `code`.
- [ ] Any other consuming team identified and contacted.
- [ ] Each affected consumer has confirmed migration to the flat fields.

If your service consumes DVLA or UNS and you read the nested `error` fields,
please let the FLEX platform team know so we can track your migration before
Phase 2.

## Related change: authentication error messages

Separately, the CloudFront Function and the Lambda authorizer now return a
constant `{ "message": "Unauthorized", "type": "auth_error" }` for every
authentication failure, regardless of reason. Previously an expired token
produced a distinct "JWT expired" message. Do not rely on the message text to
determine why authentication failed; use the HTTP status code (401 or 403).
