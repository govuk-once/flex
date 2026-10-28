# @flex/dvsa-service-gateway

Service gateway for DVSA, acting as the Anti-Corruption Layer between the FLEX platform and the remote DVSA MOT History API. Built with [`@flex/service-gateway`](/libs/service-gateway/README.md), configured in [`gateway.config.ts`](/platform/domains/dvsa/gateway.config.ts) and implemented in [`src/gateway.ts`](/platform/domains/dvsa/src/gateway.ts).

The gateway's network access is `"private"`: it runs in the VPC with internet egress and calls the remote DVSA API directly. Authentication uses an OAuth2 `client_credentials` flow against Microsoft Azure AD, with the resulting bearer token and an `X-API-Key` header forwarded to the MOT API.

---

## Commands

Run these from the repository root:

| Command                                                  | Description                            |
| -------------------------------------------------------- | -------------------------------------- |
| `pnpm --filter @flex/dvsa-service-gateway lint`          | Lint files                             |
| `pnpm --filter @flex/dvsa-service-gateway test`          | Run tests                              |
| `pnpm --filter @flex/dvsa-service-gateway test:coverage` | Run tests and generate coverage report |
| `pnpm --filter @flex/dvsa-service-gateway tsc`           | Run type check                         |

Alternatively, run `pnpm <command>` from within `platform/domains/dvsa/`.

---

## Resources

Declared in [`gateway.config.ts`](/platform/domains/dvsa/gateway.config.ts).

> `consumerConfig` is available on the handler context, while `encryptionKey` is declared for infrastructure provisioning only.

| Name             | Type     | Description                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------------- |
| `consumerConfig` | `secret` | DVSA OAuth2 credentials (`clientId`, `clientSecret`, `apiKey`) and API URLs |
| `encryptionKey`  | `kms`    | CMK provisioned for the gateway                                             |

---

## Routes

Implemented in [`src/gateway.ts`](/platform/domains/dvsa/src/gateway.ts), tested in [`src/gateway.test.ts`](/platform/domains/dvsa/src/gateway.test.ts).

| Route                     | Name              | Description                                    |
| ------------------------- | ----------------- | ---------------------------------------------- |
| `GET /v1/authenticate`    | `getAuthenticate` | OAuth2 token via Azure AD `client_credentials` |
| `GET /v1/vehicle/mot/:id` | `getVehicleMot`   | MOT history by vehicle registration number     |

---

## Clients

The `GET /v1/authenticate` route uses `flexFetch` directly (form-urlencoded POST to Azure AD). The MOT route uses a REST client built with [`createRestClient`](/libs/service-gateway/README.md#rest-client).

| Name  | Type                                                        | Base URL                   | Authentication |
| ----- | ----------------------------------------------------------- | -------------------------- | -------------- |
| `mot` | [`RestClient`](/libs/service-gateway/README.md#rest-client) | `consumerConfig.apiMotUrl` | `"public"`     |

---

## Related

**FLEX:**

- [@flex/service-gateway](/libs/service-gateway/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Platform Development Guide: Service Gateway Development](/docs/platform-development.md#service-gateway-development)
- [Developer Reference](/docs/developer-reference.md)
