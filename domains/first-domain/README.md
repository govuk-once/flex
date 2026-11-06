# @flex/first-domain

This domain demonstrates each of the available SDK features. Each endpoint showcases a different set of features:

- Query parameters
- Path parameters
- Request/response schemas
- Domain resource management
- Domain and service gateway integration management
- Feature flags
- Public/private access patterns
- Route context usage examples

The goal of this domain is to show how handlers, services and configurations fit together.

---

## Commands

Run these from the repository root:

| Command                                 | Description    |
| --------------------------------------- | -------------- |
| `pnpm --filter @flex/first-domain lint` | Lint files     |
| `pnpm --filter @flex/first-domain test` | Run tests      |
| `pnpm --filter @flex/first-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/first-domain/`.

---

## API

### Handlers

| Name                                  | Access | Description             | Code                                      |
| ------------------------------------- | ------ | ----------------------- | ----------------------------------------- |
| [`GET /v1/greeting`](#get-v1greeting) | Public | Show a greeting message | [View](./src/handlers/v1/greeting/get.ts) |

### Services

| Name                                          | Description                                               | Code                                           |
| --------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| [`getIdentityLink`](#getidentitylink)         | Fetch identity link from UDP via gateway integration      | [View](./src/services/get-identity-link.ts)    |
| [`updateNotifications`](#updatenotifications) | Generate push ID and send notification update to upstream | [View](./src/services/update-notifications.ts) |

---

## GET `/v1/greeting`

Return a "Hello" response, used for testing and onboarding to get familiar with domains on Flex.

### Response

```json
{
  "message": "Hello",
  "topicCount": 1
}
```

---

## `getIdentityLink`

Fetches an identity link from the UDP domain via a gateway integration.

- Shared between the public and private identity routes
- `404`: returns `null`
- `502`: throws `502` on upstream failures

```typescript
import { getIdentityLink } from "@services/get-identity-link";

const link = await getIdentityLink(userId);
```

---

## `updateNotifications`

Generates a push ID by hashing the user's pairwise ID with the UDP notification secret, then sends the update to the UDP domain. Uses `routeContext` to show how to access any handler context from within an external service/module.

```typescript
import { updateNotifications } from "@services/update-notifications";

const result = await updateNotifications(userId);
```

---

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@flex/udp-domain](/domains/udp/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Domain Development Guide](/docs/domain-development.md)
- [Developer Reference](/docs/developer-reference.md)
- [Deployment Guide](/docs/deployment.md)
- [Documentation Guide](/docs/documentation-guide.md)
