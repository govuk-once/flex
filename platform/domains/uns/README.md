# @flex/uns-service-gateway

Service gateway for UNS, acting as the Anti-Corruption Layer between the FLEX platform and the remote UNS API. Built with [`@flex/service-gateway`](/libs/service-gateway/README.md), configured in [`gateway.config.ts`](/platform/domains/uns/gateway.config.ts) and implemented in [`src/gateway.ts`](/platform/domains/uns/src/gateway.ts).

The gateway's network access is `"isolated"`: it runs in the VPC with no internet egress and reaches UNS's private API via a SigV4-signed, assumed-role request.

---

## Commands

Run these from the repository root:

| Command                                                 | Description                            |
| ------------------------------------------------------- | -------------------------------------- |
| `pnpm --filter @flex/uns-service-gateway lint`          | Lint files                             |
| `pnpm --filter @flex/uns-service-gateway test`          | Run tests                              |
| `pnpm --filter @flex/uns-service-gateway test:coverage` | Run tests and generate coverage report |
| `pnpm --filter @flex/uns-service-gateway tsc`           | Run type check                         |

Alternatively, run `pnpm <command>` from within `platform/domains/uns/`.

---

## Resources

Declared in [`gateway.config.ts`](/platform/domains/uns/gateway.config.ts).

> `consumerConfig` is available on the handler context, while `consumerRole` and `encryptionKey` are declared for infrastructure provisioning only.

| Name             | Type     | Description                                    |
| ---------------- | -------- | ---------------------------------------------- |
| `consumerConfig` | `secret` | UNS API credentials and role details           |
| `consumerRole`   | `role`   | Assumed IAM role for SigV4-signed calls to UNS |
| `encryptionKey`  | `kms`    | CMK provisioned for the gateway                |

---

## Routes

Implemented in [`src/gateway.ts`](/platform/domains/uns/src/gateway.ts), tested in [`src/gateway.test.ts`](/platform/domains/uns/src/gateway.test.ts).

| Route                                | Name                     |
| ------------------------------------ | ------------------------ |
| `GET /v1/groups`                     | `getGroups`              |
| `POST /v1/groups`                    | `postGroups`             |
| `GET /v1/notifications`              | `getNotifications`       |
| `GET /v1/notifications/:id`          | `getNotificationById`    |
| `PATCH /v1/notifications/:id/status` | `patchNotificationById`  |
| `DELETE /v1/notifications/:id`       | `deleteNotificationById` |

---

## Clients

Built with [`createRestClient`](/libs/service-gateway/README.md#rest-client).

| Name  | Type                                                        | Base URL                       | Authentication |
| ----- | ----------------------------------------------------------- | ------------------------------ | -------------- |
| `api` | [`RestClient`](/libs/service-gateway/README.md#rest-client) | `consumerConfig.privateApiUrl` | `"sigv4"`      |

---

## Related

**FLEX:**

- [@flex/service-gateway](/libs/service-gateway/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Platform Development Guide: Service Gateway Development](/docs/platform-development.md#service-gateway-development)
- [Developer Reference](/docs/developer-reference.md)
