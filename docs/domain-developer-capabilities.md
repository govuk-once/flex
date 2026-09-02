# FLEX capabilities for domain developers

This document outlines what the FLEX platform can and cannot do for a domain developer who wants to expose functionality to the GOV.UK app, so that the right approach can be chosen before any code is written. It is not a tutorial; for step by step instructions see [domain-development.md](domain-development.md). Everything here is taken from the code as of July 2026.

## The pattern

A domain is a folder under `domains/<name>` containing a single `domain.config.ts` and route handlers. The config is the whole contract: the platform globs `domains/*/domain.config.ts` at deploy time and provisions everything (Lambdas, API routes, IAM, networking) from it, with no central registry to edit and no CDK to write. Each route becomes its own Lambda, exposed publicly to the app at `/app/<name>/<version>/<path>` and/or privately to other domains at `/domains/<name>/...`. Handlers are written with a typed `route()` factory; Zod schemas on body, query and response drive validation, typing and the published OpenAPI spec.

## What a domain declares in domain.config.ts

- Routes: version, path, method, with `public` (app facing, Cognito authorised) and/or `private` (domain to domain, IAM authorised) exposure per method.
- Zod schemas for request body (POST/PUT/PATCH only), query parameters and response. Validation failures return 400 automatically; a response schema mismatch returns 500.
- Required headers, with automatic 400 when missing.
- Lambda tuning: memory (128 to 10240 MB), timeout (default 10s, max 900s), plain environment variables, log level.
- Network access per route: `public` (no VPC), `private` (VPC with internet egress) or `isolated` (VPC, no internet, the default). Note this is Lambda network placement, not API exposure, despite sharing the `public`/`private` names with it: an `isolated` route can still serve the app, and can still call integrations, which are reached through a VPC endpoint rather than the internet. Choose `isolated` unless the handler itself must call out to the wider internet, in which case choose `private`; no domain uses `public` today.
- Resources: SSM parameters, Secrets Manager secrets and KMS keys, resolved at deploy or runtime with least privilege IAM granted automatically.
- Integrations: typed outbound calls to other domains' private routes or to platform service gateways (see below), with optional retry with backoff (off by default) and response validation.
- Feature flags with per environment defaults.
- Environment gating: deploy a domain or route to a subset of development, staging and production.

## What the platform provides

- Authentication: Cognito JWT verification at the edge and at API Gateway. Public route handlers receive a pairwise pseudonymous user id (`auth.pairwiseId`); the raw token still travels with the request but is not surfaced to the handler unless a route declares the `Authorization` header, which none currently does.
- Edge protection: CloudFront, Shield, WAF managed rules and a global rate rule of 2000 requests per IP over a rolling five minute window.
- Structured logging with correlation ids and aggressive automatic redaction of secrets and PII (keys, JWTs, emails, NINOs, postcodes and similar).
- OpenAPI 3.1 generation and publication per domain, with a CI gate that fails a PR on breaking spec changes unless a `breaking-change-accepted` label is applied. This is what the app team consumes.
- Service to service auth: private calls are SigV4 signed and IAM scoped to exactly the routes an integration declares.
- Alarms on errors and throttles wired to Slack, X-Ray tracing, encrypted logs and environment variables.

## Reaching data outside FLEX

External partners are reached only through FLEX owned service gateways, currently DVLA, UDP and UNS. Two cases matter for planning:

1. The data lives behind an existing gateway, or in another FLEX domain: fully self service. Declare an integration in the config and call it from the handler; CI validates the target exists.
2. The data needs a new external partner: this is FLEX team work (gateway config, handler, CDK wiring and secrets provisioning in a separate repo). Budget for a cross team dependency, not a domain PR.

## Handler patterns

Three shapes are in use today, and a domain can mix them freely across its routes:

1. Passthrough: a minimal handler that validates the request and hands it straight to a service gateway, with the real work done by the department's own downstream API. FLEX contributes auth, validation, the published spec and edge protection, and the domain stays thin; the DVLA domain's wildcard routes work this way.
2. Transform: the same shape, but with App or FLEX specific manipulation of the request or response inside the handler: mapping the downstream shape to what the app wants, combining several gateway or domain calls behind one route, or deriving fields. UDP's user upsert route is this pattern at its heaviest, orchestrating user creation and notification preferences behind a single GET.
3. Pure logic: a handler with no gateway at all, where the response is computed entirely within FLEX. Useful for derivations, lookups over bundled reference data and utility endpoints; the example domain works this way. Since there is no persistence, such routes must be stateless.

A reasonable default is to start with passthrough and introduce transformation only where the app's needs and the downstream API's shape genuinely diverge, since the thinner the handler, the less there is to test and review.

## Current limits

FLEX is an expanding platform, so the limits below describe the platform today rather than permanent decisions. Where a genuine need arises (storage being the obvious example), it is something that can be added; raise it with the FLEX team early so it can be planned rather than worked around.

- Synchronous HTTP only. There is no queue, event, schedule or cron surface, so anything asynchronous needs either a platform conversation or a redesign around request/response.
- No domain owned persistence. There is no DynamoDB or S3 for domains. State must live with a partner service behind a gateway or be derivable per request. Note the gateways are strict contracts, not general stores: UDP, the only user data store, accepts only its fixed shapes (identity links with optional service tokens, a push id and a notification consent status), so arbitrary domain data cannot be parked there.
- No per domain rate limits, quotas or response caching (CloudFront and API Gateway caching are both disabled pending a platform strategy).
- Private routes carry no user identity; the caller must pass an explicit user id header.
- Log level settings are ignored in production, so debug verbosity cannot be raised there.
- No CORS configuration exists, which is fine for the app, currently the only client.
- Onboarding is not yet self service: the scaffolding CLI is still in development and does not yet produce a working domain (copy `domains/example` or the small `local-council` domain instead) and CODEOWNERS routes every domain PR through the FLEX team.

## Delivery workflow

No local API emulation exists; unit tests run the full SDK pipeline in process using `@flex/testing` fixtures, with outbound calls intercepted by nock. `pnpm run deploy` gives a personal stack, each PR gets an ephemeral `pr-<n>` environment with per domain E2E, and merges flow development to staging to production with manual approval gates. PRs need conventional commit titles and a FLEX team review.

## Deciding how to proceed

- New read or write functionality over data already behind a gateway: a new domain (or a route in an existing one) is self service and quick; `local-council` is the best small template.
- Functionality needing a new external data source: raise it with the FLEX team first, since the gateway is the long pole.
- Functionality needing stored state, background work or events: not currently expressible in FLEX; the design should be challenged or the gap raised with the FLEX team before committing.
