# @flex/udp-service-gateway

Service gateway for UDP, acting as the Anti-Corruption Layer between the FLEX platform and the remote UDP API. Built with [`@flex/service-gateway`](/libs/service-gateway/README.md), configured in [`gateway.config.ts`](/platform/domains/udp/gateway.config.ts) and implemented in [`src/gateway.ts`](/platform/domains/udp/src/gateway.ts).

The gateway's network access is `"isolated"`: it runs in the VPC with no internet egress and reaches UDP's private API via a SigV4-signed, assumed-role request.

---

## Commands

Run these from the repository root:

| Command                                                 | Description                            |
| ------------------------------------------------------- | -------------------------------------- |
| `pnpm --filter @flex/udp-service-gateway lint`          | Lint files                             |
| `pnpm --filter @flex/udp-service-gateway test`          | Run tests                              |
| `pnpm --filter @flex/udp-service-gateway test:coverage` | Run tests and generate coverage report |
| `pnpm --filter @flex/udp-service-gateway tsc`           | Run type check                         |

Alternatively, run `pnpm <command>` from within `platform/domains/udp/`.

---

## Resources

Declared in [`gateway.config.ts`](/platform/domains/udp/gateway.config.ts).

> `consumerConfig` is available on the handler context, while `consumerRole` and `cmk` are declared for infrastructure provisioning only.

| Name             | Type     | Description                                    |
| ---------------- | -------- | ---------------------------------------------- |
| `consumerConfig` | `secret` | UDP API credentials and role details           |
| `consumerRole`   | `role`   | Assumed IAM role for SigV4-signed calls to UDP |
| `cmk`            | `kms`    | CMK provisioned for the gateway                |

---

## Routes

Implemented in [`src/gateway.ts`](/platform/domains/udp/src/gateway.ts), tested in [`src/gateway.test.ts`](/platform/domains/udp/src/gateway.test.ts).

| Route                                          | Name                            |
| ---------------------------------------------- | ------------------------------- |
| `GET /v1/identities/:id`                       | `getIdentities`                 |
| `GET /v1/identity/:serviceName`                | `getIdentityLink`               |
| `GET /v1/notifications`                        | `getNotificationPreferences`    |
| `POST /v1/identity/:serviceName/:identifier`   | `createIdentityLink`            |
| `POST /v1/notifications`                       | `updateNotificationPreferences` |
| `POST /v1/users`                               | `createUser`                    |
| `DELETE /v1/identity/:serviceName/:identifier` | `deleteIdentityLink`            |
| `DELETE /v1/notifications`                     | `deleteNotificationPreferences` |
| `GET /v1/groups`                               | `getGroupSubscriptions`         |
| `POST /v1/groups`                              | `updateGroupSubscriptions`      |

---

## Clients

| Name  | Type                                                        | Base URL                | Authentication |
| ----- | ----------------------------------------------------------- | ----------------------- | -------------- |
| `api` | [`RestClient`](/libs/service-gateway/README.md#rest-client) | `consumerConfig.apiUrl` | `"sigv4"`      |

---

## Related

**FLEX:**

- [@flex/service-gateway](/libs/service-gateway/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Platform Development Guide: Service Gateway Development](/docs/platform-development.md#service-gateway-development)
- [Developer Reference](/docs/developer-reference.md)
