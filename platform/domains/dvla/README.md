# @flex/dvla-service-gateway

Service gateway for DVLA, acting as the Anti-Corruption Layer between the FLEX platform and the remote DVLA API. Built with [`@flex/service-gateway`](/libs/service-gateway/README.md), configured in [`gateway.config.ts`](/platform/domains/dvla/gateway.config.ts) and implemented in [`src/gateway.ts`](/platform/domains/dvla/src/gateway.ts).

The gateway's network access is `"private"`: it runs in the VPC with internet egress and calls the remote DVLA API directly, authenticating with `X-API-KEY` and a bearer token rather than SigV4.

> `GET /v1/well-known-jwks` caches the fetched key set in memory for the duration of the Lambda execution environment.
>
> `GET /v1/authenticate` caches the DVLA session token in memory and reuses it until 60 seconds before it expires.
>
> If a route returns `401` or `403`, the handler clears its caches and retries the request once.

---

## Commands

Run these from the repository root:

| Command                                                  | Description                            |
| -------------------------------------------------------- | -------------------------------------- |
| `pnpm --filter @flex/dvla-service-gateway lint`          | Lint files                             |
| `pnpm --filter @flex/dvla-service-gateway test`          | Run tests                              |
| `pnpm --filter @flex/dvla-service-gateway test:coverage` | Run tests and generate coverage report |
| `pnpm --filter @flex/dvla-service-gateway tsc`           | Run type check                         |

Alternatively, run `pnpm <command>` from within `platform/domains/dvla/`.

---

## Resources

Declared in [`gateway.config.ts`](/platform/domains/dvla/gateway.config.ts).

> `consumerConfig` is available on the handler context, while `encryptionKey` is declared for infrastructure provisioning only.

| Name             | Type     | Description                     |
| ---------------- | -------- | ------------------------------- |
| `consumerConfig` | `secret` | DVLA API credentials and URLs   |
| `encryptionKey`  | `kms`    | CMK provisioned for the gateway |

---

## Routes

Implemented in [`src/gateway.ts`](/platform/domains/dvla/src/gateway.ts), tested in [`src/gateway.test.ts`](/platform/domains/dvla/src/gateway.test.ts).

| Route                            | Name                       | Requires            |
| -------------------------------- | -------------------------- | ------------------- |
| `GET /v1/authenticate`           | `getAuthenticate`          | -                   |
| `GET /v1/customer/licence`       | `getCustomerLicence`       | `auth`, `linkingId` |
| `GET /v1/customer/vehicles`      | `getCustomerVehicles`      | `auth`, `linkingId` |
| `GET /v1/customer/vehicle/:id`   | `getCustomerVehicle`       | `auth`, `linkingId` |
| `GET /v1/vehicle-enquiry/:id`    | `getVehicleEnquiryService` | `auth`              |
| `GET /v1/well-known-jwks`        | `getWellKnownJwk`          | -                   |
| `POST /v1/share-code`            | `postShareCode`            | `auth`, `linkingId` |
| `POST /v1/share-code/:id/cancel` | `postShareCodeCancel`      | `auth`, `linkingId` |
| `POST /v1/test-notification/:id` | `postTestNotification`     | `auth`              |
| `POST /v1/unlink-user/:id`       | `postUnlinkUser`           | `auth`              |

`auth` is the DVLA session token header from `GET /v1/authenticate`, and `linkingId` is a query parameter holding the user's DVLA linking ID.

---

## Schemas

[`src/schemas/remote`](/platform/domains/dvla/src/schemas/remote) holds types for the DVLA API's own request and response formats. [`src/schemas/domain`](/platform/domains/dvla/src/schemas/domain) holds Zod schemas, exported from [`src/index.ts`](/platform/domains/dvla/src/index.ts), that [`@flex/dvla-domain`](/domains/dvla/README.md) uses to validate the gateway's responses. Most routes return DVLA's response unchanged.

---

## Clients

Built with [`createRestClient`](/libs/service-gateway/README.md#rest-client).

| Name   | Type                                                        | Base URL                         | Authentication |
| ------ | ----------------------------------------------------------- | -------------------------------- | -------------- |
| `api`  | [`RestClient`](/libs/service-gateway/README.md#rest-client) | `consumerConfig.apiUrl`          | `"public"`     |
| `jwks` | [`RestClient`](/libs/service-gateway/README.md#rest-client) | `consumerConfig.wellKnownJwkUrl` | `"public"`     |

---

## Related

**FLEX:**

- [@flex/service-gateway](/libs/service-gateway/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
- [@flex/dvla-domain](/domains/dvla/README.md): the domain that calls this gateway
- [DVLA secret rotation](/platform/domains/dvla-secret-rotation): rotates the `consumerConfig` credentials

**Guides:**

- [Platform Development Guide: Service Gateway Development](/docs/platform-development.md#service-gateway-development)
- [Developer Reference](/docs/developer-reference.md)
