---
title: CloudFront Functions
description: The two viewer-request CloudFront Functions, what each checks or rewrites, and how they are built.
---

Two CloudFront Functions run on the Flex distribution, before a request reaches its origin. Both are
created by the `<stage>-FlexGlobal` stack
([`global.ts`](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/stacks/global.ts))
and run on the viewer-request event.

| Package | Directory | Behaviour | Origin |
| --- | --- | --- | --- |
| `@platform/viewer-request-cff-platform` | `platform/domains/viewer-request-cff-platform` | Default, every API request | The public API Gateway |
| `@platform/viewer-request-cff-docs` | `platform/domains/viewer-request-cff-docs` | `/docs*` | The S3 bucket holding the API documentation |

See [The platform](/flex/start/platform/) for where they sit in the journey of a request.

## Platform function

The platform function sets a correlation id on every request and rejects any request without a
well-formed bearer token
([source](https://github.com/govuk-once/flex/blob/main/platform/domains/viewer-request-cff-platform/src/handler.ts)).
Rejected requests never reach API Gateway, so they cost no API Gateway request or authorizer
invocation.

1. It reads `x-correlation-id`. If the header is missing or is not a UUID v4, it derives one from
   CloudFront's request id and writes it onto the request. The derived id is a SHA-256 of the
   request id formatted as a UUID v4, so the same request always gets the same id.
2. It checks the `Authorization` header and the token's structure.
3. It forwards the request if every check passes, and returns a `401` if any fails.

| Check | Failure telemetry |
| --- | --- |
| `Authorization` is present and not empty | `cff_token_missing` |
| It starts with `Bearer` followed by one space | `cff_token_invalid` |
| It has no more than two space-separated parts | `cff_token_invalid` |
| A token follows `Bearer` | `cff_token_missing` |
| The token has exactly three dot-separated segments, none empty | `cff_token_invalid` |
| The header segment decodes from base64 to a JSON object | `cff_token_invalid` |
| The header's `alg` is not `none` | `cff_token_invalid` |
| The body segment decodes from base64 to a JSON object | `cff_token_invalid` |

The checks are structural only. The function does not verify the signature, the issuer or the
expiry; the [Lambda authorizer](/flex/edge/authorizer/) does.

### Rejection

Every failure returns the same response, so it does not reveal which check failed:

| Property | Value |
| --- | --- |
| Status | `401` |
| Body | `{ "message": "Unauthorized", "type": "auth_error" }` |
| `content-type` | `application/json` |
| `x-rejected-by` | `cloudfront-function` |

The body matches what API Gateway returns when the authorizer denies a request. The
`x-rejected-by` header tells the two apart, and the platform E2E suite asserts on it.

### Telemetry

The function emits one event per request through `@flex/telemetry/cff`: `cff_token_validated` when
it forwards the request, or the failure event from the table above. Every event carries the
correlation id, and failures also carry the reason. CloudFront Functions can only log with
`console.log`, so the events are written there. See
[Telemetry](/flex/observability/telemetry/) for the event fields.

## Docs function

The docs function makes directory-style URLs work on the S3 origin, which does not resolve
`index.html` by itself
([source](https://github.com/govuk-once/flex/blob/main/platform/domains/viewer-request-cff-docs/src/handler.ts)).
It handles each path in its list, which is currently only `/docs`:

| Request URI | Result |
| --- | --- |
| `/docs` | `301` redirect to `/docs/` |
| `/docs/` | URI rewritten to `/docs/index.html`, then forwarded |
| Anything else | Forwarded unchanged |

It performs no authentication. See [OpenAPI](/flex/domains/openapi/) for the documentation it
serves.

## How the functions are built

`FlexCloudfrontFunction`
([source](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/constructs/cloudfront/flex-cloudfront-function.ts))
bundles `src/handler.ts` with esbuild at synth time and deploys the result inline on the
`cloudfront-js-2.0` runtime. The runtime is not Node.js, which shapes how the handlers are written:

- Export the handler as `export function handler(event) { ... }`. The construct strips the export
  so `handler` is a top-level function, and fails the synth if the handler is an arrow function.
- Identifiers are not minified, so `handler` keeps its name.
- The bundle targets ES5, with the features the runtime supports enabled. The existing handlers
  avoid destructuring.
- `crypto`, `querystring` and `buffer` are left as imports for the runtime to provide. Other
  dependencies are bundled in, so keep them small and free of Node.js APIs.

Each function has its own CloudWatch alarms for execution errors, throttles and validation errors.
See [Alarms](/flex/observability/alarms/).

To add a function or test one, see [Platform handlers](/flex/edge/platform-handlers/).
