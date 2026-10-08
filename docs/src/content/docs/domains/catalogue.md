---
title: Domain catalogue
description: Every domain in the repository, what it is for, its routes and what it calls.
---

This page lists each domain in `domains/`. The request and response shapes of every route are in
the domain's [OpenAPI document](/flex/domains/openapi/). The gateways the domains call are
described in [Service gateways](/flex/gateways/catalogue/).

| Domain | Purpose | Environments | Access | Calls |
| --- | --- | --- | --- | --- |
| [`dvla`](#dvla) | The user's driving licence, vehicles and share codes | development, staging, production | `private` | DVLA gateway, UDP domain |
| [`example`](#example) | Shows every SDK feature | development | `isolated` | UDP and UNS gateways, UDP domain, itself |
| [`groups`](#groups) | The user's notification groups | development, staging | `isolated` | UNS and UDP gateways, UDP domain |
| [`local-council`](#local-council) | A user's local authority | development, staging | `isolated` | UDP gateway |
| [`topics`](#topics) | The topics a user has chosen | development, staging | `isolated` | UDP gateway |
| [`travel`](#travel) | Travel countries and alerts | development, staging | `isolated` | Travel gateway |
| [`udp`](#udp) | The user's record, service links and notification consent | development, staging, production | `isolated` | UDP and DVLA gateways, DVLA domain |
| [`uns`](#uns) | The user's notifications | development, staging, production | `isolated` | UNS gateway, UDP domain |

Access is the domain's `common.access`. No route overrides it. Every domain sets a
`timeoutSeconds` of 20 or 30 in `common.function`. In personal and PR stages, every domain
deploys whatever its environments say. See [Configuration](/flex/domains/configuration/).

Several domains work out a user's push id, the id the notification service knows them by. It is
an HMAC-SHA256 of the pairwise id with the UDP notification secret, encoded as base64url. The UDP
domain's private `GET /v1/users/push-id` returns it, and `udp` and `example` also compute it
themselves.

## dvla

Lets the app show a user's DVLA data once they have linked their DVLA account. Each route asks
the DVLA gateway for an access token, then, for the user's own data, asks the UDP domain for the
user's DVLA linking id. It then passes the request through to the DVLA gateway. A missing link
returns `404`. On every public route except the vehicle enquiry, a DVLA `404` with a known code, such as
`GUK-404-01` for a linking id that is no longer valid, returns `404` with that `code`.

| Route | What it does |
| --- | --- |
| `GET /v1/customer/licence` | The user's driving licence |
| `GET /v1/customer/vehicles` | The user's vehicles |
| `GET /v1/customer/vehicle/:id` | One of the user's vehicles |
| `GET /v1/vehicle-enquiry/:reg` | Looks up a vehicle by registration. Needs no link. |
| `POST /v1/share-code` | Creates a share code for the user |
| `POST /v1/share-code/:id/cancel` | Cancels a share code |
| `POST /v1/test-notification` | Asks DVLA to send the user a test notification. Returns `202`. |
| `POST /v1/unlink [private]` | Tells DVLA to unlink the user given in the `User-Id` header. The UDP domain calls it. |

## example

Shows how handlers, services and configuration fit together, with each route using a different
set of SDK features. It deploys to development only. Its todos are held in memory in each Lambda
instance, so they reset whenever an instance starts.

| Route | Shows |
| --- | --- |
| `GET /v0/todos` | `query` with coerced values and defaults, `response`, a feature flag (`enableTodoMetadata`) changing the response |
| `POST /v0/todos [private]` | A private route, `body` with schema defaults, `response` |
| `GET /v0/todos/:id` | `pathParams`, a feature flag, a thrown `404` |
| `DELETE /v0/todos/:id` | A `204` with no body |
| `POST /v0/todos/:id/duplicate` | A `domain` integration to the domain's own private route, with typed `body` and `response` |
| `GET /v0/headers` | Common and route headers merged, required and optional |
| `GET /v0/resources` | `ssm`, `kms` and `secret` resources. It returns their lengths, not their values. |
| `GET /v0/resources/runtime` | An `ssm:runtime` resource |
| `GET /v0/identity/:service` | A wildcard `gateway` integration, and a service shared with the private route through `routeContext` with a union of route keys |
| `GET /v0/identity/:service [private]` | The same service on a private route, with a required `User-Id` header and a `response` schema |
| `PATCH /v0/notifications` | A service that reads `body`, `resources` and `integrations` through `routeContext`, and a route-level `function` override |
| `GET /v0/users/notifications` | Chaining a `domain` integration (the UDP push id) into a `gateway` integration (UNS) |
| `PATCH /v0/users/notifications` | Reading a feature flag (`newUserProfileEnabled`) in the handler, with chained integrations |

## groups

Manages the notification groups a user belongs to, using their push id.

| Route | What it does |
| --- | --- |
| `GET /v1/groups` | The user's groups from the UNS gateway |
| `POST /v1/groups` | Sends the user's groups to the UNS gateway, then saves them in the UDP gateway alongside any groups of other types already stored there |

## local-council

Saves and reads a user's local authority. Its routes are private, for other domains to call. Both
call `/v1/local-council/:id` on the UDP gateway, which does not yet define those routes, so they
return an error until it does.

| Route | What it does |
| --- | --- |
| `GET /v1/local-council/:id [private]` | Reads the local authority |
| `POST /v1/local-council/:id [private]` | Saves the local authority |

## topics

Stores the topics a user has chosen, in the UDP gateway.

| Route | What it does |
| --- | --- |
| `GET /v1/topics` | The user's selected topics, or an empty list if UDP has no record of the user |
| `PATCH /v1/topics` | Replaces the user's selected topics. An empty `selectedTopics` clears them. Returns `204`. |

## travel

Passes travel data from the travel gateway to the app.

| Route | What it does |
| --- | --- |
| `GET /v1/countries` | The list of countries |
| `GET /v1/events` | Recent travel alerts, filtered by the `namespace` and `group` query parameters |

## udp

The app's view of the User Data Platform: the user's record, the services they have linked, and
their notification consent. It calls the UDP gateway for storage.

| Route | What it does |
| --- | --- |
| `GET /v1/users/me` | Returns the user's notification preferences. On a user's first call, it creates the user and their preferences, with consent `unknown`. |
| `PATCH /v1/users/me/notifications` | Updates the user's notification consent |
| `GET /v1/users/push-id [private]` | Returns the push id of the user in the `User-Id` header |
| `GET /v1/identity` | The services the user has linked |
| `GET /v1/identity/:service` | Whether the user has linked the service |
| `GET /v1/identity/:service [private]` | The link for the user in the `User-Id` header, or `404` |
| `POST /v1/identity/:service` | Links the user's DVLA account. See below. |
| `DELETE /v1/identity/:service` | Removes a link. In production, for DVLA, it first calls the DVLA domain's private unlink route. |

`POST /v1/identity/:service` accepts only `dvla`, and returns `403` for any other service. It
reads two headers: `x-linking-token`, a JWE from DVLA, and `Authorization`, the user's bearer
token. It decrypts the JWE with a KMS key and verifies the JWT inside against DVLA's published
keys and issuer. It then checks that the session hash in the JWT matches the user's token, and
stores the linking id. It returns `201` for a new link and `204` if the same link already exists.

## uns

Gives the app the user's notifications. Each route gets the user's push id from the UDP domain,
then calls the UNS gateway with it.

| Route | What it does |
| --- | --- |
| `GET /v1/notifications` | The user's notifications |
| `GET /v1/notifications/:notificationId` | One notification |
| `DELETE /v1/notifications/:notificationId` | Deletes a notification |
| `PATCH /v1/notifications/:notificationId/status` | Updates a notification's status. Returns `202`. |
