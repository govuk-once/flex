# @flex/dvla-service-gateway

Service gateway for DVLA, acting as the Anti-Corruption Layer between the FLEX platform and the remote DVLA API. Built with [`@flex/service-gateway`](/libs/service-gateway/README.md), configured in [`gateway.config.ts`](/platform/domains/dvla/gateway.config.ts) and implemented in [`src/gateway.ts`](/platform/domains/dvla/src/gateway.ts).

The gateway's network access is `"private"`: it runs in the VPC with internet egress and calls the remote DVLA API directly, authenticating with `X-API-KEY` and a bearer token rather than SigV4.

> `GET /v1/well-known-jwks` caches the fetched key set in memory for the duration of the Lambda execution environment.

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

| Route                            | Name                       |
| -------------------------------- | -------------------------- |
| `GET /v1/authenticate`           | `getAuthenticate`          |
| `GET /v1/customer/licence`       | `getCustomerLicence`       |
| `GET /v1/customer/vehicles`      | `getCustomerVehicles`      |
| `GET /v1/customer/vehicle/:id`   | `getCustomerVehicle`       |
| `GET /v1/vehicle-enquiry/:id`    | `getVehicleEnquiryService` |
| `GET /v1/well-known-jwks`        | `getWellKnownJwk`          |
| `POST /v1/share-code`            | `postShareCode`            |
| `POST /v1/share-code/:id/cancel` | `postShareCodeCancel`      |
| `POST /v1/test-notification/:id` | `postTestNotification`     |
| `POST /v1/unlink-user/:id`       | `postUnlinkUser`           |

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

**Guides:**

- [Platform Development Guide: Service Gateway Development](/docs/platform-development.md#service-gateway-development)
- [Developer Reference](/docs/developer-reference.md)
