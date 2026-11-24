# @flex/dvla-domain

Exposes DVLA driving licence, vehicle and share code data to the app. Handlers never call the remote DVLA API directly; every request goes through the [DVLA service gateway](/platform/domains/dvla/README.md), which owns the DVLA credentials. Responses are validated against the gateway's schemas, re-exported in [`src/schemas`](./src/schemas/index.ts).

---

## Commands

Run these from the repository root:

| Command                                    | Description       |
| ------------------------------------------ | ----------------- |
| `pnpm --filter @flex/dvla-domain lint`     | Lint files        |
| `pnpm --filter @flex/dvla-domain test`     | Run tests         |
| `pnpm --filter @flex/dvla-domain test:e2e` | Run the e2e tests |
| `pnpm --filter @flex/dvla-domain tsc`      | Run type check    |

Alternatively, run `pnpm <command>` from within `domains/dvla/`.

---

## API

### Handlers

| Name                                                           | Access  | Description                                   | Code                                                     |
| -------------------------------------------------------------- | ------- | --------------------------------------------- | -------------------------------------------------------- |
| [`GET /v1/customer/licence`](#get-v1customerlicence)           | Public  | Get the user's driving licence                | [View](./src/handlers/v1/customer/licence/get.ts)        |
| [`GET /v1/customer/vehicles`](#get-v1customervehicles)         | Public  | List the user's vehicles                      | [View](./src/handlers/v1/customer/vehicles/get.ts)       |
| [`GET /v1/customer/vehicle/:id`](#get-v1customervehicleid)     | Public  | Get one of the user's vehicles                | [View](./src/handlers/v1/customer/vehicle/[id]/get.ts)   |
| [`GET /v1/vehicle-enquiry/:reg`](#get-v1vehicle-enquiryreg)    | Public  | Look up a vehicle by registration number      | [View](./src/handlers/v1/vehicle-enquiry/[reg]/get.ts)   |
| [`POST /v1/share-code`](#post-v1share-code)                    | Public  | Create a driving licence share code           | [View](./src/handlers/v1/share-code/post.ts)             |
| [`POST /v1/share-code/:id/cancel`](#post-v1share-codeidcancel) | Public  | Cancel a share code                           | [View](./src/handlers/v1/share-code/[id]/cancel/post.ts) |
| [`POST /v1/test-notification`](#post-v1test-notification)      | Public  | Ask DVLA to send the user a test notification | [View](./src/handlers/v1/test-notification/post.ts)      |
| [`POST /v1/unlink`](#post-v1unlink-private)                    | Private | Unlink a user's DVLA account                  | [View](./src/handlers/v1/unlink/post.private.ts)         |

### Request flow

Every handler except `GET /v1/vehicle-enquiry/:reg` works on behalf of a user, and does the following:

1. Looks up the user's DVLA linking ID from the UDP domain (`GET /v1/identity/dvla`).
2. Gets a DVLA session token from the gateway (`GET /v1/authenticate`).
3. Calls the matching gateway route with the token and linking ID.

Public routes take the user from the authenticated request. The private unlink route takes it from the `User-Id` header.

### Errors

Implemented in [`src/services/errors.ts`](./src/services/errors.ts).

| Status | When                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| `400`  | DVLA rejected the request                                                                |
| `404`  | The user has no DVLA linking ID, or DVLA returned a mapped `404` code (see below)        |
| `429`  | DVLA rate-limited the request                                                            |
| `502`  | Authentication with DVLA failed, the UDP lookup failed, or DVLA returned any other error |

Mapped DVLA `404` codes are returned with a body of the form:

```json
{
  "code": "GUK-404-01",
  "message": "Linking ID held is no longer valid"
}
```

`GUK-404-01` is mapped for every route that handles mapped codes. Individual routes may map extra codes, listed in their sections below. `GET /v1/vehicle-enquiry/:reg` and `POST /v1/unlink` do not map any codes.

---

## GET `/v1/customer/licence`

Returns the authenticated user's driving licence.

**Response:** `200 OK` with [`DriversLicenceSchema`](./src/schemas/licence.ts).

**Extra `404` codes:**

| Code         | Message                   |
| ------------ | ------------------------- |
| `GUK-404-04` | Driving Licence not found |
| `GUK-404-05` | Resource not found        |

---

## GET `/v1/customer/vehicles`

Returns the vehicles linked to the authenticated user.

**Response:** `200 OK` with [`CustomerVehiclesSchema`](./src/schemas/vehicle.ts).

---

## GET `/v1/customer/vehicle/:id`

Returns a single vehicle linked to the authenticated user.

**Path parameters:** `id`, the DVLA vehicle ID.

**Response:** `200 OK` with [`CustomerVehicleSchema`](./src/schemas/vehicle.ts).

---

## GET `/v1/vehicle-enquiry/:reg`

Looks up a vehicle by registration number. It does not use the user's linking ID.

**Path parameters:** `reg`, the vehicle registration number.

**Response:** `200 OK` with [`VehicleSchema`](./src/schemas/vehicle.ts).

---

## POST `/v1/share-code`

Creates a share code for the authenticated user's driving licence. No request body is needed.

**Response:** `200 OK` with [`ShareCodeWithoutIdSchema`](./src/schemas/share-code.ts).

---

## POST `/v1/share-code/:id/cancel`

Cancels one of the authenticated user's share codes. No request body is needed.

**Path parameters:** `id`, the share code ID.

**Response:** `200 OK` with [`ShareCodeWithoutIdSchema`](./src/schemas/share-code.ts).

---

## POST `/v1/test-notification`

Asks DVLA to send a test notification to the authenticated user. No request body is needed.

**Response:** `202 Accepted` with no body.

---

## POST `/v1/unlink` (private)

Unlinks a user's DVLA account. This route is only available on the private gateway, for platform callers.

**Headers:**

| Header    | Required | Description                |
| --------- | -------- | -------------------------- |
| `User-Id` | Yes      | The FLEX user ID to unlink |

**Response:** `200 OK` with the gateway's response body.

---

## Related

**FLEX:**

- [@flex/dvla-service-gateway](/platform/domains/dvla/README.md)
- [@flex/udp-domain](/domains/udp/README.md)
- [@flex/sdk](/libs/sdk/README.md)
- [@flex/testing](/libs/testing/README.md)
- [Domain Development Guide](/docs/domain-development.md)
