---
title: Gateway catalogue
description: Every service gateway in platform/domains, with its upstream, access, resources, routes and clients.
---

Every gateway lives in `platform/domains/<name>/`, with its configuration in `gateway.config.ts`
and its handlers in `src/gateway.ts`. Those two files are the source of truth for the details
below; [Configuration](/flex/gateways/configuration/) explains the terms.

| Gateway | Package | Upstream | Access | Upstream auth | Environments | Called by |
| --- | --- | --- | --- | --- | --- | --- |
| [`dvla`](#dvla) | `@flex/dvla-service-gateway` | DVLA's API for the GOV.UK app | `private` | API key and a bearer token | development, staging, production | `dvla`, `udp` |
| [`udp`](#udp) | `@flex/udp-service-gateway` | User Data Platform private API | `isolated` | SigV4, assumed role, plus API key | development, staging, production | `udp`, `example`, `groups`, `local-council`, `topics` |
| [`uns`](#uns) | `@flex/uns-service-gateway` | UNS private notifications API | `isolated` | SigV4, assumed role, plus API key | development, staging, production | `uns`, `example`, `groups` |
| [`travel`](#travel) | `@flex/travel-service-gateway` | Two DynamoDB tables | `private` | Assumed role | development, staging | `travel` |

The "Called by" column lists the domains with a `"gateway"` integration to that gateway. See the
[domain catalogue](/flex/domains/catalogue/) for what each domain does.

## dvla

Calls DVLA's third-party API for driving licence and vehicle data. It runs with internet egress and
calls DVLA directly
([config](https://github.com/govuk-once/flex/blob/main/platform/domains/dvla/gateway.config.ts),
[handlers](https://github.com/govuk-once/flex/blob/main/platform/domains/dvla/src/gateway.ts)).

| Resource | Type | Purpose |
| --- | --- | --- |
| `consumerConfig` | `secret` | `apiKey`, `apiUrl`, `apiUsername`, `apiPassword`, `wellKnownJwkUrl` |
| `encryptionKey` | `kms` | Grants decrypt on the key at `/secret/encryption-key`, which encrypts the secret |

| Client | Base URL | Auth |
| --- | --- | --- |
| `api` | `consumerConfig.apiUrl` | `public`, with an `X-Correlation-Id` generated per request and logged |
| `jwks` | `consumerConfig.wellKnownJwkUrl` | `public` |

| Route | Name | Upstream call |
| --- | --- | --- |
| `GET /v1/authenticate` | `getAuthenticate` | `POST /thirdparty-access/v1/authenticate` with the stored username and password |
| `GET /v1/customer/licence` | `getCustomerLicence` | `POST /govuk-app-service/v1/retrieve-customer-driving-licence` |
| `GET /v1/customer/vehicles` | `getCustomerVehicles` | `POST /govuk-app-service/v1/find-customer-vehicles` |
| `GET /v1/customer/vehicle/:id` | `getCustomerVehicle` | `POST /govuk-app-service/v1/retrieve-customer-vehicle-by-vehicle-id` |
| `GET /v1/vehicle-enquiry/:id` | `getVehicleEnquiryService` | `POST /govuk-app-service/v1/retrieve-vehicle-by-vrn` |
| `GET /v1/well-known-jwks` | `getWellKnownJwk` | `GET /.well-known/jwks.json` on the `jwks` client |
| `POST /v1/share-code` | `postShareCode` | `POST /govuk-app-service/v1/create-driving-licence-share-code` |
| `POST /v1/share-code/:id/cancel` | `postShareCodeCancel` | `POST /govuk-app-service/v1/cancel-driving-licence-share-code` |
| `POST /v1/test-notification/:id` | `postTestNotification` | `POST /govuk-app-service/v1/test-notification` |
| `POST /v1/unlink-user/:id` | `postUnlinkUser` | `POST /govuk-app-service/v1/unlink-customer` |

Every route except `authenticate` and `well-known-jwks` requires an `auth` header, which is sent
upstream as `Authorization` together with the API key as `X-API-KEY`. Routes about a customer take
`linkingId` as a query parameter, or as the `:id` for `test-notification` and `unlink-user`, and send
it in the upstream body.

The handler keeps two caches for the life of the execution environment:

- `authenticate` reuses the token DVLA returned until less than 60 seconds remain before its `exp`.
- `well-known-jwks` keeps the first successful key set.

It also wraps the generated handler: if any route returns `401` or `403`, it clears the cached
secret, and for `authenticate` the cached token, then retries the request once. This picks up
credentials that [secret rotation](#dvla-secret-rotation) has changed since the secret was cached.

`src/index.ts` exports the gateway's domain schemas, which the `dvla` domain imports.

### dvla-secret-rotation

`platform/domains/dvla-secret-rotation` is not a gateway. It is the Secrets Manager rotation
function for the DVLA gateway's secret, deployed by the `<env>-FlexCore` stack in persistent
environments
([infrastructure](https://github.com/govuk-once/flex/blob/main/platform/infra/flex/src/stacks/core/dvla-secret-rotation.ts),
[handler](https://github.com/govuk-once/flex/blob/main/platform/domains/dvla-secret-rotation/src/handler.ts)).
Secrets Manager invokes it every 60 days.

| Rotation step | What it does |
| --- | --- |
| `createSecret` | Changes the DVLA password to a new random 20-character password, authenticates with it, asks DVLA for a new API key, and stores both as the `AWSPENDING` version |
| `setSecret` | Nothing. DVLA applies the new credentials as soon as they are issued |
| `testSecret` | Authenticates with the pending credentials |
| `finishSecret` | Promotes the pending version to `AWSCURRENT` |

Changing the password and issuing a key are two upstream calls. So that a failure between them
does not lose the new password, it is saved first under a separate `AWSPENDING_CHECKPOINT` label.
The next attempt resumes with the checkpointed password instead of changing it again. The function has Lambda retries turned off, because a blind retry
could leave the credentials in a broken state.

## udp

Calls the User Data Platform's private API, for identity links, users, notification preferences,
topics and group subscriptions. It runs in the isolated subnets and signs each request with SigV4
using an assumed role
([config](https://github.com/govuk-once/flex/blob/main/platform/domains/udp/gateway.config.ts),
[handlers](https://github.com/govuk-once/flex/blob/main/platform/domains/udp/src/gateway.ts)).

| Resource | Type | Purpose |
| --- | --- | --- |
| `consumerConfig` | `secret` | `apiAccountId`, `apiKey`, `apiUrl`, `consumerRoleArn`, `region`, optional `externalId` |
| `consumerRole` | `role` | Grants `sts:AssumeRole` on the role used for signing |
| `cmk` | `kms` | Grants decrypt on the key at `/udp/cmk-arn` |

| Client | Base URL | Auth |
| --- | --- | --- |
| `api` | `consumerConfig.apiUrl` | `sigv4`, assuming `consumerRoleArn` with session name `consumer-session` |

Every upstream call also sends the API key as `x-api-key`.

| Route | Name | Upstream call |
| --- | --- | --- |
| `GET /v1/identities/:id` | `getIdentities` | `GET /v1/identity/app/:id/linked-services` |
| `GET /v1/identity/:serviceName` | `getIdentityLink` | `GET /v1/identity/exchange?requiredService=:serviceName` |
| `POST /v1/identity/:serviceName/:identifier` | `createIdentityLink` | `POST /v1/identity/:serviceName/:identifier`, adding an `expiresAt` 60 days ahead |
| `DELETE /v1/identity/:serviceName/:identifier` | `deleteIdentityLink` | `DELETE /v1/identity/:serviceName/:identifier` |
| `POST /v1/users` | `createUser` | `POST /v1/user` |
| `GET /v1/notifications` | `getNotificationPreferences` | `GET /v1/notifications` |
| `POST /v1/notifications` | `updateNotificationPreferences` | `POST /v1/notifications` |
| `DELETE /v1/notifications` | `deleteNotificationPreferences` | `DELETE /v1/notifications` |
| `GET /v1/topics` | `getTopics` | `GET /v1/topics` |
| `POST /v1/topics` | `upsertTopics` | `POST /v1/topics` |
| `GET /v1/groups` | `getGroupSubscriptions` | `GET /v1/groups` |
| `POST /v1/groups` | `updateGroupSubscriptions` | `POST /v1/groups` |

The user-scoped routes take the user from a header: `User-Id` for `getIdentityLink`, and
`requesting-service-user-id` for the notifications, topics and groups routes. The gateway sends it
upstream as `requesting-service-user-id` with `requesting-service: app`. The `GET` and `POST`
notifications, topics and groups routes unwrap UDP's `data` envelope with `mapApiResult` and
validate the result with a `response` schema.

## uns

Calls the UNS private API for notification groups and a user's notifications. It runs in the
isolated subnets and signs each request with SigV4 using an assumed role
([config](https://github.com/govuk-once/flex/blob/main/platform/domains/uns/gateway.config.ts),
[handlers](https://github.com/govuk-once/flex/blob/main/platform/domains/uns/src/gateway.ts)).

| Resource | Type | Purpose |
| --- | --- | --- |
| `consumerConfig` | `secret` | `apiKey`, `apiUrl`, `privateApiUrl`, `region`, `roleArn` |
| `consumerRole` | `role` | Grants `sts:AssumeRole` on the role used for signing |
| `encryptionKey` | `kms` | Grants decrypt on the key at `/uns/cmk-arn` |

| Client | Base URL | Auth |
| --- | --- | --- |
| `api` | `consumerConfig.privateApiUrl` | `sigv4`, assuming `roleArn` with session name `uns-consumer-session`, and `X-API-KEY` on every request |

| Route | Name | Upstream call |
| --- | --- | --- |
| `GET /v1/groups` | `getGroups` | `GET /v1/groups?pushID=` |
| `POST /v1/groups` | `postGroups` | `POST /v1/groups?pushID=` |
| `GET /v1/notifications` | `getNotifications` | `GET /notifications?externalUserID=` |
| `GET /v1/notifications/:id` | `getNotificationById` | `GET /notifications/:id?externalUserID=` |
| `PATCH /v1/notifications/:id/status` | `patchNotificationById` | `PATCH /notifications/:id/status?externalUserID=` |
| `DELETE /v1/notifications/:id` | `deleteNotificationById` | `DELETE /notifications/:id?externalUserID=` |

Each route passes its required query parameter, `pushID` or `externalUserID`, through unchanged.
The groups routes validate their response with a `response` schema.

## travel

Reads travel advice sources and events from two DynamoDB tables, using credentials from an assumed
role. It runs with internet egress because the VPC has no DynamoDB endpoint. It
is not deployed to production
([config](https://github.com/govuk-once/flex/blob/main/platform/domains/travel/gateway.config.ts),
[handlers](https://github.com/govuk-once/flex/blob/main/platform/domains/travel/src/gateway.ts)).

| Resource | Type | Purpose |
| --- | --- | --- |
| `consumerConfig` | `secret` | `sourcesTableName`, `eventStoreTableName`, `region`, `roleArn`, optional `externalId` |
| `consumerRole` | `role` | Grants `sts:AssumeRole` on the role that can read the tables |
| `cmk` | `kms` | Grants decrypt on the key at `/travel/cmk-arn` |

| Client | Table | Auth |
| --- | --- | --- |
| `sources` | `sourcesTableName`, the shared sources table for every namespace | `role`, session name `travel-data-session` |
| `events` | `eventStoreTableName` | `role`, session name `travel-data-session` |

| Route | Name | What it does |
| --- | --- | --- |
| `GET /v1/countries` | `getCountries` | Scans `sources` for items with `sourceNamespace = travel` and `sourceEnabled = true`, maps each to a country and sorts by country name |
| `GET /v1/events` | `getEvents` | Queries `events` on the `timestamp-query` index for `compositeKey = <namespace>/<group>`, newest first. `namespace` must be `travel` and `group` is required |

`src/index.ts` exports the gateway's schemas and table constants, which the `travel` domain imports.
