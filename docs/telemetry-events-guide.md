# FLEX telemetry events: a guide for analytics users

This document explains the telemetry events that the FLEX platform records, what each event means, and what extra information each one carries. It is written for readers who will work with the data rather than the code, so no programming knowledge is assumed. It is not a technical reference for developers (the code and its READMEs serve that purpose), and it does not cover operational logging, which is separate from telemetry.

Note: at present these events are written into the platform's logs (AWS CloudWatch) but are not yet pushed to an analytics platform. That connection is planned. This guide describes what will be available once it is in place, and the event names and fields below are the ones that will appear there.

## How to read an event name

Every event has a fixed name in `snake_case` (lowercase words joined by underscores). Names follow a rough pattern of *where_what_outcome*, so `auth_token_expired` reads as: in the auth area, a token was presented and found to be expired. There are 23 events, grouped into six areas below.

Each event may also carry a small set of extra fields, called details, such as the HTTP status code or a human readable reason. These are listed per event.

## The journey of a request

The areas correspond to the stages a user's request passes through, so it is worth knowing the order:

1. **CFF (CloudFront Function)**: a lightweight check at the network edge, before the request reaches the platform proper. It checks that a login token is present and correctly formed, but not whether it is genuine.
2. **Auth**: the real authentication check. The token is cryptographically verified and the user identified.
3. **Domain**: the part of the platform that handles the request itself, e.g. the DVLA domain answering "what vehicles does this user have".
4. **Service gateway**: an internal component that domains call when they need data from outside. It sits between the domains and the outside world.
5. **Third party**: the external organisations' APIs (DVLA, DWP and so on) that the service gateway calls on the domain's behalf.

A successful request therefore produces a chain of events: `cff_token_validated`, then `auth_success`, then `domain_request_received`, and (if external data was needed) `service_gateway_request_sent`, `service_gateway_request_received`, `third_party_request_sent`, `third_party_response_received`, `service_gateway_response_returned`, and finally `domain_response_returned`.

## Event reference

### CFF (edge checks)

| Event | Meaning |
|---|---|
| `cff_token_validated` | A request arrived with a structurally valid login token and was passed through. |
| `cff_token_missing` | The request had no login token (or an empty one) and was rejected. |
| `cff_token_invalid` | A token was present but malformed, and the request was rejected. |

Details: all three carry `correlationId` (an identifier that links the events of a single request together). The two failure events also carry `reason`, a short description of what was wrong.

Note: rejections here happen before any real verification, so `cff_token_invalid` counts badly formed requests, not forged tokens.

### Auth (login verification)

| Event | Meaning |
|---|---|
| `auth_success` | The token was verified and the user identified. |
| `auth_token_missing` | No token was supplied to the verifier. |
| `auth_token_expired` | The token was genuine but past its expiry time. This is normal behaviour (sessions time out) rather than a fault. |
| `auth_token_invalid` | The token failed verification: bad signature, wrong issuer, or the verification service itself was unreachable. |
| `auth_claim_missing` | The token verified but did not contain the expected user identifier. |
| `auth_failure` | An authentication failure that fits none of the above. Expected to be rare; a rise in this event is worth investigating. |

Details: `auth_success` carries `pairwiseId`, a pseudonymous user identifier (it identifies the same user consistently without revealing who they are), which supports counting distinct users. The failure events carry `reason`.

### Domain (request handling)

| Event | Meaning |
|---|---|
| `domain_request_received` | A request reached a domain. Carries `method` (GET, POST etc.) and `path` (the address requested). |
| `domain_response_returned` | The domain answered successfully. Carries `status` (the HTTP status code). |
| `domain_error_returned` | The domain answered with an error. Carries `status` and `path`. |

Every request produces exactly one `domain_request_received` and then exactly one of the other two, so the ratio between them is the domain success rate.

### Service gateway (internal relay)

| Event | Meaning |
|---|---|
| `service_gateway_request_sent` | A domain asked the gateway for something. Carries `method` and `path`. |
| `service_gateway_request_received` | The gateway received that request. Carries `method` and `path`. |
| `service_gateway_response_returned` | The gateway answered successfully. Carries `status`. |
| `service_gateway_error_returned` | The gateway answered with an error. Carries `status`, and where the cause was a failing external service, `upstreamStatus` (the status the external service actually gave, before the gateway translated it). |

Sent and received should track each other closely; a persistent gap between them would indicate requests being lost between domain and gateway.

### Third party (external calls)

| Event | Meaning |
|---|---|
| `third_party_request_sent` | The gateway called an external API. Carries `method`, `baseUrl` (which organisation) and `path` (which endpoint). |
| `third_party_response_received` | The external API answered. Carries `baseUrl`, `path` and `status`. Note this fires for error answers as well as successes; the `status` distinguishes them. |
| `third_party_request_retried` | A call failed and was automatically retried. Carries `url` and `attemptNumber`. Retries are invisible in the sent/received counts, so this event is the measure of external flakiness: a service can look healthy on final outcomes while quietly needing three attempts per call. |
| `third_party_request_timeout` | A call was abandoned because the external service took too long. Carries `url` and `reason`. |
| `third_party_request_error` | A call failed outright (network failure, connection refused and similar). Carries `url` and `reason`. |

### General (cross cutting)

These three can occur in more than one area, so they are best read alongside the events around them.

| Event | Meaning |
|---|---|
| `request_validation_failed` | An incoming request was rejected because it was badly formed. Carries `part` (whether the headers, query or body were at fault). This separates "the caller sent something wrong" from genuine platform errors, so error rates are not polluted by client mistakes. |
| `response_validation_failed` | An answer (usually from an external service) did not match the format the platform expects. This signals a contract break, i.e. an external service changing its output, which is a different problem from that service being down. |
| `error_thrown` | An unexpected internal error occurred. Carries `reason`. Any sustained volume of this event indicates a platform fault. |

## Standard context on every event

Events from the platform's services arrive as log entries that also carry standard context added automatically: the service name, a timestamp, the request identifier, and tracing identifiers. The CFF events are leaner (that environment is severely constrained) and carry only the fields listed above plus a timestamp added by the logging system; the `correlationId` in their details is the field that ties them to the rest of a request's chain.

## Caveats worth knowing

- Nothing is flowing to an analytics platform yet. The events exist in CloudWatch logs today; the export comes later.
- One user action can legitimately produce many events (the full chain above), so event counts are not request counts. `domain_request_received` is the closest thing to a request count.
- Failure events deliberately overlap: a bad request to the gateway produces both a `request_validation_failed` (why) and a `service_gateway_error_returned` (what the caller saw). Counting both as separate incidents would double count.
- `third_party_request_timeout` depends on a time limit being set on the call, which is not yet configured everywhere, so early data will likely show such failures under `third_party_request_error` instead.
- The three transport level events (`third_party_request_retried`, `third_party_request_timeout`, `third_party_request_error`) cover every outbound call the platform makes, which includes the internal calls from domains to the service gateway as well as calls to external organisations. The `url` field distinguishes them: internal calls go to the platform's own gateway address rather than an external one.
