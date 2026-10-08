---
title: Telemetry
description: The @flex/telemetry analytics events, how they are written and queried, how to add one, and what every event means.
---

Telemetry events are a fixed set of named events that record what happened to a request, for
analytics. `@flex/telemetry` (in `libs/telemetry`) writes each one as a structured log line, so
today they live in CloudWatch Logs next to the function's other logs. They are not exported
anywhere else yet.

Most events are emitted by the platform itself: the CloudFront Function, the authorizer, the domain
SDK and the gateway library. A domain or gateway gets them without writing any code.

## How an event is written

`emitTelemetry` writes an `INFO` line through [`@flex/logging`](/flex/observability/logging/), with
the message `telemetry` and the event under a `telemetry` key:

```typescript
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";

emitTelemetry(TelemetryEvent.domain_response_returned, { status: 200 });
```

```json
{
  "level": "INFO",
  "message": "telemetry",
  "timestamp": "2026-10-06T09:14:03.120Z",
  "service": "example-public-v0-list-todos",
  "function_name": "...",
  "request_id": "...",
  "xray_trace_id": "...",
  "correlation_id": "...",
  "telemetry": {
    "event": "domain_response_returned",
    "details": { "status": 200 }
  }
}
```

Because it goes through the logger:

- The details are sanitised like any other log line. A detail that looks like a secret or personal
  data is redacted.
- The line carries the logger's standard fields (see
  [Log format](/flex/observability/logging/#log-format)).
- The line is only written if the logger is at `INFO` or more verbose. In production it always is.
  Outside production, a route configured with `logLevel` `WARN` or above writes no telemetry.

To find events in CloudWatch Logs Insights:

```text
filter ispresent(telemetry.event)
| stats count() by telemetry.event
```

## CloudFront Functions

A CloudFront Function cannot run `@flex/logging`: it has no Node.js APIs and a 10 KB code limit. The
`@flex/telemetry/cff` entry point has no dependencies and writes the same shape straight to
`console.log`:

```typescript
import { CffTelemetryEvent, emitCffTelemetry } from "@flex/telemetry/cff";

emitCffTelemetry(CffTelemetryEvent.cff_token_validated, { correlationId });
// {"level":"INFO","message":"telemetry","telemetry":{"event":"cff_token_validated","details":{...}}}
```

These lines have no timestamp of their own (CloudWatch records one), no service or request fields,
and no sanitisation. Never pass a sensitive value as a detail. The lines are written to the
CloudFront Function's log group in us-east-1.

## Adding an event

1. Add the name to `TelemetryEventSchema` in
   [`libs/telemetry/src/events.ts`](https://github.com/govuk-once/flex/blob/main/libs/telemetry/src/events.ts),
   in its area's group. Names are `snake_case` and read as area, subject, outcome.
2. For an event emitted from a CloudFront Function, add it to the `CffTelemetryEvent` object in
   `src/cff.ts` instead, with the `cff_` prefix. The two registries are separate because the Zod
   enum cannot be bundled into a CloudFront Function. An event belongs in exactly one of them.
3. Emit it with `emitTelemetry` or `emitCffTelemetry`. Keep details to a few small, non-sensitive
   fields.
4. Add it to the [event catalogue](#event-catalogue) below.

## Testing

Both entry points ship a Vitest manual mock. The mocks keep the real event registries and replace
the emit functions with spies:

```typescript
vi.mock("@flex/telemetry");

expect(emitTelemetry).toHaveBeenCalledWith(TelemetryEvent.auth_success, {
  pairwiseId: "user-123",
});
```

Mock the CloudFront Function entry point with `vi.mock("@flex/telemetry/cff")`.

## Event catalogue

This section is written for people analysing the data. It needs no knowledge of the code.

### Reading an event

Every event has a fixed name in `snake_case`, such as `auth_token_expired`: in the auth area, a
token was expired. Each event can carry a few extra fields, called details, such as an HTTP status
code. There are 24 events in six areas.

Events are found under `telemetry.event`, and their details under `telemetry.details`.

### The journey of a request

The areas follow the order a request passes through Flex:

1. **CFF (CloudFront Function)**: a quick check at the network edge that a login token is present
   and well formed. It does not check the token is genuine.
2. **Auth**: the real check. The token is verified and the user identified.
3. **Domain**: the part of Flex that handles the request, such as the DVLA domain answering "what
   vehicles does this user have".
4. **Service gateway**: the internal component a domain calls when it needs data from outside Flex.
5. **Third party**: the outside organisation's API, or AWS service, that the gateway calls.

A successful request that needs outside data produces this chain:

```text
cff_token_validated
auth_success
domain_request_received
  service_gateway_request_sent
  service_gateway_request_received
    third_party_request_sent
    third_party_response_received
  service_gateway_response_returned
domain_response_returned
```

### CFF

| Event | Meaning | Details |
| --- | --- | --- |
| `cff_token_validated` | The request had a well-formed login token and was passed on. | `correlationId` |
| `cff_token_missing` | The request had no login token, or an empty one, and was rejected. | `correlationId`, `reason` |
| `cff_token_invalid` | The token was malformed, or the check failed unexpectedly, and the request was rejected. | `correlationId`, `reason` |

`correlationId` links a request's events together. It is the same value as `correlation_id` on the
request's later events.

These checks are structural only, so `cff_token_invalid` counts badly formed requests, not forged
tokens.

### Auth

| Event | Meaning | Details |
| --- | --- | --- |
| `auth_success` | The token was verified and the user identified. | `pairwiseId` |
| `auth_token_missing` | No token reached the verifier. | `reason` |
| `auth_token_expired` | The token was genuine but past its expiry time. Sessions time out, so this is normal. | `reason` |
| `auth_token_invalid` | The token failed verification: a bad signature, a wrong issuer or audience, or the signing keys could not be fetched. | `reason` |
| `auth_claim_missing` | The token verified but had no user identifier. | `reason` |
| `auth_failure` | An authentication failure that fits none of the above. It should be rare; a rise is worth investigating. | `reason` |

`pairwiseId` is a pseudonymous user identifier. It is the same for the same user every time without
revealing who they are, so it can count distinct users.

API Gateway caches the authorizer's decision for a token for five minutes. Within that time, more
requests with the same token produce no auth event. `auth_success` counts verifications, not
requests.

### Domain

| Event | Meaning | Details |
| --- | --- | --- |
| `domain_request_received` | A request reached a domain. | `method` (GET, POST and so on), `path` |
| `domain_response_returned` | The domain's handler returned a response. | `status` |
| `domain_error_returned` | The request failed validation, or the handler threw an error, and the domain returned an error response. | `status`, `path` |

Every request produces one `domain_request_received` and then one of the other two.
`domain_response_returned` includes error statuses the handler chose to return, such as a 404 for
something that does not exist. To measure success, group `domain_response_returned` by `status`
rather than dividing the two events.

### Service gateway

| Event | Meaning | Details |
| --- | --- | --- |
| `service_gateway_request_sent` | A domain called another domain or a gateway. | `method`, `path` |
| `service_gateway_request_received` | A gateway received a request. | `method`, `path` |
| `service_gateway_response_returned` | The gateway answered successfully. | `status` |
| `service_gateway_error_returned` | The gateway answered with an error. | `status`; `upstreamStatus` when the cause was the outside service failing |

`service_gateway_request_sent` fires for every call a domain makes through an integration,
including calls to other domains. Its `path` starts `/gateways/` for a gateway and `/domains/` for
a domain. Sent and received should track each other closely for gateway paths; a lasting gap would
mean requests lost between domain and gateway.

`upstreamStatus` is the status the outside service actually returned, before the gateway turned it
into a 502.

### Third party

| Event | Meaning | Details |
| --- | --- | --- |
| `third_party_request_sent` | The gateway called an outside API, or DynamoDB. | `method`, `baseUrl` (which organisation), `path` (which endpoint); or `service`, `table`, `operation` for DynamoDB |
| `third_party_response_received` | The outside API answered. This fires for error answers too; `status` tells them apart. | `baseUrl`, `path`, `status`; or `service`, `table`, `operation` and sometimes `count` for DynamoDB |
| `third_party_request_retried` | A call failed and was retried automatically. | `url`, `attemptNumber` |
| `third_party_request_timeout` | A call was abandoned because it took too long. | `url`, `reason` |
| `third_party_request_error` | A call failed outright, such as a network failure or refused connection. | `url`, `reason`; or `service`, `table` and `operation` for DynamoDB |

Retries do not show in the sent and received counts, so `third_party_request_retried` is the
measure of how unreliable an outside service is. A service can look healthy on final outcomes while
needing three attempts per call.

The retried, timeout and error events come from Flex's HTTP client, which domains and gateways use
for every outbound HTTP call. That includes calls from domains to gateways and other domains, not only calls to outside
organisations. The `url` tells them apart: internal calls go to the platform's private API.

The gateway library has two DynamoDB clients. The older `createDynamoClient` names the table
`tableName` rather than `table`.

### General

These can happen in more than one area. Read them alongside the events around them.

| Event | Meaning | Details |
| --- | --- | --- |
| `request_validation_failed` | A request was rejected because it was badly formed. This separates "the caller sent something wrong" from platform errors. | `part` (`headers`, `query` or `body`); `path` in domains; `service`, `table`, `operation` for a rejected DynamoDB request |
| `response_validation_failed` | A response did not match the shape Flex expects: a domain handler's response, a gateway's response, or an outside service's answer. An outside service changing its output is a different problem from it being down. | `path`; or `url` and `status`; or `service`, `table`, `operation` for DynamoDB |
| `error_thrown` | An unexpected error occurred. Any lasting volume means a platform fault. | `reason`; `path` in domains |

### Caveats

- One user action produces many events, so event counts are not request counts.
  `domain_request_received` is the closest thing to a request count.
- Failure events overlap on purpose. A bad request to a gateway produces both
  `request_validation_failed` (why) and `service_gateway_error_returned` (what the caller saw).
  Counting both double counts.
- `third_party_request_timeout` needs a time limit on the call, which is not set everywhere. Early
  data will show many timeouts as `third_party_request_error`.
