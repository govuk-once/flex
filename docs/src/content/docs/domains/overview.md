---
title: Domains
description: What a domain is, what the platform does for it, its current limits, and how to choose an approach before writing code.
---

A domain is the code behind one area of the GOV.UK app. It is a workspace package in
`domains/<name>/` with one configuration file, `domain.config.ts`, and a handler file for each
route. The configuration is the whole contract with the platform. When the CDK app synthesizes,
it finds every `domains/*/domain.config.ts` and creates the Lambda functions, API Gateway routes,
IAM permissions and networking from it. There is no central list to edit and no CDK to write.

Each route of each domain is its own Lambda function. A route can be:

- **public**: called by the app at `/app/<domain>/<version>/<path>`, with the user authenticated
  by the Lambda authorizer
- **private**: called by other domains at `/domains/<domain>/<version>/<path>` on the private API,
  authorised with IAM

[The platform](/flex/start/platform/) describes the path a request takes from the app to a domain
and on to a third party.

## What a domain declares

| Declares | Page |
| --- | --- |
| Routes: version, path and method, each public, private or both | [Configuration](/flex/domains/configuration/) |
| Zod schemas for the request body, query parameters and response | [Configuration](/flex/domains/configuration/) |
| Required and optional request headers | [Configuration](/flex/domains/configuration/#headers) |
| Lambda memory, timeout, environment variables, log level and network access | [Configuration](/flex/domains/configuration/#function-options) |
| Feature flags, and the environments the domain and each route deploy to | [Configuration](/flex/domains/configuration/#feature-flags) |
| SSM parameters, Secrets Manager secrets and KMS keys | [Resources](/flex/domains/resources/) |
| Calls to other domains' private routes and to service gateways | [Integrations](/flex/domains/integrations/) |

Handlers are written with the typed `route()` function the configuration returns. The context a
handler receives is typed from the route's configuration. See [Handlers](/flex/domains/handlers/).

## What the platform provides

- **Authentication.** Public routes only run for a user with a valid token. The handler gets the
  user's pairwise id as `auth.pairwiseId`, never the token itself, unless the route declares the
  `Authorization` header. See [Lambda authorizer](/flex/edge/authorizer/).
- **Validation.** The SDK checks headers, the body and query parameters before the handler runs,
  and checks the response after. Failures return the platform's
  [error responses](/flex/domains/handlers/#error-responses).
- **Calls between services.** Integrations are signed with SigV4. Each Lambda function may only
  call the private routes its integrations declare.
- **Least-privilege access** to the parameters, secrets and keys each route names.
- **Edge protection.** CloudFront, AWS WAF and, in staging and production, AWS Shield Advanced
  sit in front of every public route. See [The platform](/flex/start/platform/).
- **Observability.** Structured logs with sensitive values redacted
  ([Logging](/flex/observability/logging/)), telemetry events
  ([Telemetry](/flex/observability/telemetry/)), X-Ray tracing, and error and throttle alarms on
  every function ([Alarms](/flex/observability/alarms/)).
- **An OpenAPI document** for each domain, published with each deployment and checked for
  breaking changes on every pull request. This is what the app team builds against. See
  [OpenAPI](/flex/domains/openapi/).

## Current limits

Flex is still growing, so these describe the platform today, not permanent decisions. If a domain
needs one of them, storage being the likeliest, raise it with the Flex team early so it can be
planned rather than worked around.

- **Synchronous HTTP only.** A domain has routes and nothing else: no queue, event, schedule or
  cron. Anything asynchronous needs a platform conversation or a redesign around request and
  response.
- **No storage of its own.** There is no DynamoDB table or S3 bucket for a domain. State must live
  with a partner service behind a service gateway, or be worked out on each request. The gateways
  expose fixed operations, not a general store: the UDP gateway, for example, holds identity
  links, users, notification preferences, topics and groups in the shapes it defines.
- **Handlers are stateless.** Each request may run in a new Lambda instance, and the SDK empties
  `/tmp` after every invocation.
- **No rate limits, quotas or caching per domain.** The only rate limit is the per-IP rule in AWS
  WAF. Caching is off in CloudFront, and API Gateway has no cache.
- **Private routes carry no user identity.** A caller passes the user id in a header the private
  route declares, such as `User-Id`.
- **Log levels cannot be raised in production.** See [Logging](/flex/observability/logging/).
- **No CORS configuration.** The app is the only client, so none is needed yet.
- **Onboarding is not self-service.** `@flex/cli` has a create-domain screen, but its templates
  predate the SDK and do not produce a working domain. Copy `domains/local-council` or
  `domains/example` instead. `CODEOWNERS` sends every change under `domains/` to the Flex team for
  review.

## Handler shapes

Three shapes are in use. A domain can mix them across its routes.

| Shape | What the handler does | Example |
| --- | --- | --- |
| Passthrough | Validates the request and hands it to a service gateway. The department's own API does the work. Flex adds authentication, validation, the published contract and edge protection. | The DVLA routes, such as `GET /v1/vehicle-enquiry/:reg` |
| Transform | The same, with changes to suit the app: maps the upstream shape, combines several calls behind one route, or derives fields. | UDP's `GET /v1/users/me`, which creates the user and their notification preferences on first call |
| Pure logic | Works out the response inside Flex, with no gateway call. Suits derivations, lookups over bundled reference data and utility routes. It must be stateless. | UDP's private `GET /v1/users/push-id`, and the example domain's todos |

Start with passthrough. Add transformation only where what the app needs and what the upstream
API returns really differ. The thinner the handler, the less there is to test and review.

## Reaching data outside Flex

A domain reaches an external partner only through a service gateway owned by the Flex team. There
are gateways for DVLA, UDP, UNS and travel. See [Service gateways](/flex/gateways/overview/).

| Where the data is | What to do |
| --- | --- |
| Behind an existing gateway, or in another domain | Self-service. Declare an [integration](/flex/domains/integrations/) and call it from the handler. CI checks that every domain integration points at a private route that exists. |
| With a partner Flex does not reach yet | Flex team work: a new gateway under `platform/domains/`, and the partner's secrets and parameters, which are provisioned outside this repository. Plan for a dependency on another team, not a single pull request. |

## Deciding how to proceed

- **New reads or writes over data already behind a gateway.** Add a domain, or a route to an
  existing one. `local-council` is the smallest domain to copy. See
  [Creating a domain](/flex/domains/creating-a-domain/).
- **A new external data source.** Talk to the Flex team first. The gateway takes longest.
- **Stored state, background work or events.** Flex cannot express these yet. Challenge the
  design, or raise the gap with the Flex team, before committing to it.

Once a domain exists, unit tests run the whole SDK pipeline in process
([Testing](/flex/domains/testing/)), `pnpm run deploy` gives you a personal stage, and each pull
request gets its own environment ([Environments](/flex/delivery/environments/)). Merged changes
deploy to development, staging and production in turn ([Pipeline](/flex/delivery/pipeline/)).
There is no local emulation of the API.
