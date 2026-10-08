---
title: Lambda authorizer
description: How the @platform/auth Lambda authorizer verifies Cognito access tokens on public routes, and the JWKS endpoint used in development.
---

The Lambda authorizer verifies the access token on every request to a public route and passes the
user's pairwise id to the domain handler. It lives in `platform/domains/auth` as `@platform/auth`
([source](https://github.com/govuk-once/flex/blob/main/platform/domains/auth/src/handler.ts)).

It runs after the [CloudFront Function](/flex/edge/cloudfront-functions/) has checked the token's
structure. The authorizer is the check that verifies the signature and claims.

## Where it runs

The `<stage>-FlexPlatform` stack creates the authorizer as a `FlexPrivateEgressFunction`, with a
10-second timeout. It needs internet egress to fetch the JSON Web Key Set (JWKS). The stack exports
its ARN to `/<stage>/flex/apigw/public/authorizer-fn`.

Each domain stack that has public routes imports that ARN and attaches it to them as a token
authorizer, with the `Authorization` header as its identity source. Private routes do not use it:
the private API authorises callers with IAM.

API Gateway caches each result for five minutes, the CDK default, keyed by the `Authorization`
header. An `Allow` result applies to every route, so a cached `Allow` lets the same token reach
any public route without invoking the authorizer again.

## Behaviour

1. It takes the token from the `Authorization` header, as the part after the first space.
2. It verifies the token's signature against the JWKS at `JWKS_URI`, and checks that the issuer is
   the configured Cognito user pool, that the token is an access token (`token_use: access`), that
   its `client_id` is the configured client, and that it has not expired.
3. It reads the pairwise id from the token's `username` claim.
4. It returns an `Allow` policy for every route, with `pairwiseId` in the authorizer context.

Any failure returns a `Deny` policy for the requested route. The domain handler receives the
pairwise id as `auth.pairwiseId`; see [Handlers](/flex/domains/handlers/).

| Situation | Response to the caller |
| --- | --- |
| No `Authorization` header | API Gateway returns `401` without invoking the authorizer |
| The authorizer returns `Deny` | API Gateway returns `403` |

Both responses have the body `{ "message": "Unauthorized", "type": "auth_error" }`, set as gateway
responses on the public API. The caller cannot tell from the response why authentication failed.

## Configuration

| Environment variable | Description |
| --- | --- |
| `AWS_REGION` | Region of the Cognito issuer. Set by Lambda |
| `USERPOOL_ID` | Cognito user pool id |
| `CLIENT_ID` | Cognito app client id |
| `JWKS_URI` | The JWKS used to verify signatures |

The values come from SSM parameters that are created outside this repository:

| Environment | `USERPOOL_ID` and `CLIENT_ID` | `JWKS_URI` |
| --- | --- | --- |
| `staging`, `production` | `/<env>/flex-param/auth/user-pool-id` and `/<env>/flex-param/auth/client-id` | The user pool's own `/.well-known/jwks.json` |
| `development`, personal and PR stages | `/development/flex-param/auth/stub/user-pool-id` and `/development/flex-param/auth/stub/client-id` | The [JWKS endpoint](#jwks-endpoint) |

## Telemetry

The authorizer emits one event per request. Failure events carry the error message as `reason`.

| Event | When |
| --- | --- |
| `auth_success` | The token is valid. Carries `pairwiseId` |
| `auth_token_expired` | The token has expired |
| `auth_token_missing` | There is no token after the scheme |
| `auth_claim_missing` | The token has no `username` claim |
| `auth_token_invalid` | Any other verification failure, such as a bad signature, issuer, client or token use. A JWKS that cannot be fetched also lands here |
| `auth_failure` | An error that is not a token error, such as missing configuration |

Logs use the service name `auth-authorizer`. See [Telemetry](/flex/observability/telemetry/) for
the event catalogue.

## JWKS endpoint

In development, personal and PR stages, the authorizer trusts a stub user pool and verifies tokens
against a key Flex controls, so tests can mint tokens it accepts. The platform stack serves the
public half of that key from a second Lambda in the same package,
`src/functions/jwks-endpoint.ts`
([source](https://github.com/govuk-once/flex/blob/main/platform/domains/auth/src/functions/jwks-endpoint.ts)).

| Property | Value |
| --- | --- |
| Exposed by | A Lambda function URL with no authentication |
| Key source | The `n` and `kid` fields of the Secrets Manager secret `/development/flex-secret/auth/e2e/private_jwk` |
| Response | A JWKS with one RS256 signing key |
| Caching | The secret is cached for five minutes |
| Failure | `500` with `{ "message": "Internal Server Error" }` |

The endpoint is not created in `staging` or `production`. E2E and smoke tests sign tokens with the
private half of the key; see [`@flex/testing`](/flex/reference/flex-testing/).
