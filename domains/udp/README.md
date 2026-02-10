# @flex/udp-domain

User Data Platform domain providing user settings management.

---

## Commands

Run these from the repository root:

| Command                               | Description    |
| ------------------------------------- | -------------- |
| `pnpm --filter @flex/udp-domain lint` | Lint files     |
| `pnpm --filter @flex/udp-domain test` | Run tests      |
| `pnpm --filter @flex/udp-domain tsc ` | Run type check |

Alternatively, run `pnpm <command>` from within `domains/udp/`.

---

## API

### Handlers

| Name                         | Access           | Description                       | Code                                 |
| ---------------------------- | ---------------- | --------------------------------- | ------------------------------------ |
| [`GET /user`](#get-user)     | Private Isolated | Returns derived notification ID   | [View](./src/handlers/user/get.ts)   |
| [`PATCH /user`](#patch-user) | Private Isolated | Updates user settings preferences | [View](./src/handlers/user/patch.ts) |

### Services

| Name                                      | Description                                  | Code                                |
| ----------------------------------------- | -------------------------------------------- | ----------------------------------- |
| [`generateDerivedId`](#generatederivedid) | Generates deterministic ID using HMAC-SHA256 | [View](./src/service/derived-id.ts) |

---

## GET `/user`

Returns a deterministic derived ID for the authenticated user.

### Configuration

| Environment Variable           | Description                          |
| ------------------------------ | ------------------------------------ |
| `FLEX_UDP_NOTIFICATION_SECRET` | SSM path for notification secret key |

### Response

```json
{
  "notificationId": "base64url-encoded-derived-id"
}
```

### Middlewares

- `extractUser`: extracts `pairwiseId` from authorizer context
- `createSecretsMiddleware`: resolves notification secret from SSM
- `httpResponseSerializer`: serialises response as JSON

---

## PATCH `/user`

Updates user settings preferences.

### Request

```json
{
  "notifications_consented": true,
  "analytics_consented": false
}
```

### Response

```json
{
  "preferences": {
    "notifications_consented": true,
    "analytics_consented": false,
    "updated_at": "2025-01-30T12:00:00.000Z"
  }
}
```

### Middlewares

- `extractUser`: extracts `pairwiseId` from authorizer context
- `httpHeaderNormalizer`: normalises HTTP headers
- `httpJsonBodyParser`: parses JSON request body
- `httpResponseSerializer`: serialises response as JSON

---

## `generateDerivedId`

Generates a deterministic derived ID using HMAC-SHA256 with base64url encoding.

```typescript
import { generateDerivedId } from "./service/derived-id";

const id = generateDerivedId({
  pairwiseId: "user-pairwise-id",
  secretKey: "secret-from-ssm", // pragma: allowlist secret
});

// id = "base64url-encoded-hmac"
```

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/middlewares](/libs/middlewares/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex: UDP Domain](/platform/infra/flex/src/constructs/udp.ts)
- [Domain Development Guide](/docs/domain-development.md)
