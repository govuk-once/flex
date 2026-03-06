# @flex/poc-domain

TODO: Description

---

## Commands

Run these from the repository root:

| Command                               | Description    |
| ------------------------------------- | -------------- |
| `pnpm --filter @flex/poc-domain lint` | Lint files     |
| `pnpm --filter @flex/poc-domain test` | Run tests      |
| `pnpm --filter @flex/poc-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/poc/`.

---

## API

### Handlers

| Name                                   | Description       | Code                                           |
| -------------------------------------- | ----------------- | ---------------------------------------------- |
| [`GET /public`](#get-public)           | TODO: Description | [View](./src/handlers/v1/public/get.ts)        |
| [`GET /private`](#get-private)         | TODO: Description | [View](./src/handlers/v1/private/get.ts)       |
| [`GET /isolated`](#get-isolated)       | TODO: Description | [View](./src/handlers/v1/isolated/get.ts)      |
| [`PATCH /isolated`](#patch-isolated)   | TODO: Description | [View](./src/handlers/v1/isolated/patch.ts)    |
| [`GET /isolated/:id`](#get-isolatedid) | TODO: Description | [View](./src/handlers/v1/isolated/[id]/get.ts) |

---

## GET `/public`

TODO: Description

### Response

```json
{
  "message": "Public GET",
  "context": {
    "logger": "<logger_instance>",
    "queryParams": {
      "page": 1,
      "limit": 20,
      "sort": "desc"
    },
    "resources": {
      "encryptionKeyArn": "<arn>",
      "flexUdpNotificationSecret": "<secret>"
    }
  }
}
```

## GET `/private`

TODO: Description

### Response

```json
{
  "message": "Private GET",
  "context": {
    "logger": "<logger_instance>",
    "auth": {
      "pairwiseId": "<id>"
    },
    "resources": {
      "encryptionKeyArn": "<arn>",
      "flexUdpNotificationSecret": "<secret>"
    }
  }
}
```

## GET `/isolated`

TODO: Description

### Response

```json
{
  "message": "Isolated GET",
  "context": {
    "logger": "<logger_instance>",
    "auth": {
      "pairwiseId": "<id>"
    },
    "resources": {
      "encryptionKeyArn": "<arn>",
      "flexUdpNotificationSecret": "<secret>"
    }
  }
}
```

## PATCH `/isolated`

TODO: Description

### Response

```json
{
  "message": "Isolated PATCH",
  "context": {
    "logger": "<logger_instance>",
    "auth": {
      "pairwiseId": "<id>"
    },
    "resources": {
      "encryptionKeyArn": "<arn>",
      "flexUdpNotificationSecret": "<secret>"
    },
    "body": {
      "message": "<string>"
    }
  }
}
```

## GET `/isolated/:id`

TODO: Description

### Response

```json
{
  "message": "Isolated GET + path params",
  "context": {
    "logger": "<logger_instance>",
    "auth": {
      "pairwiseId": "<id>"
    },
    "resources": {
      "encryptionKeyArn": "<arn>",
      "flexUdpNotificationSecret": "<secret>"
    },
    "pathParams": {
      "id": "<string>"
    }
  }
}
```

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
- [@platform/flex: POC Domain](/platform/infra/flex/src/stack.ts)
- [Domain Development Guide](/docs/domain-development.md)
