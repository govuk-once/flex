# @flex/example-domain

This domain demonstrates each of the available SDK features. Each endpoint showcases a different set of features:

- Query parameters
- Path parameters
- Request/response schemas
- Domain resource management
- Domain integration management
- Feature flags
- Public/private access patterns
- Route context usage examples

The goal of this domain is to show how handlers, services and configurations fit together.

---

## Commands

Run these from the repository root:

| Command                                   | Description    |
| ----------------------------------------- | -------------- |
| `pnpm --filter @flex/example-domain lint` | Lint files     |
| `pnpm --filter @flex/example-domain test` | Run tests      |
| `pnpm --filter @flex/example-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/example/`.

---

## API

### Handlers

| Name                                                          | Access  | Description                                             | Code                                                        |
| ------------------------------------------------------------- | ------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| [`GET /v0/todos`](#get-v0todos)                               | Public  | List todos with query parameters and feature flags      | [View](./src/handlers/v0/todos/get.ts)                      |
| [`POST /v0/todos`](#post-v0todos-private)                     | Private | Create a todo with request body validation              | [View](./src/handlers/v0/todos/post.private.ts)             |
| [`GET /v0/todos/:id`](#get-v0todosid)                         | Public  | Get a todo by ID with path parameters and feature flags | [View](./src/handlers/v0/todos/[id]/get.ts)                 |
| [`DELETE /v0/todos/:id`](#delete-v0todosid)                   | Public  | Delete a todo                                           | [View](./src/handlers/v0/todos/[id]/delete.ts)              |
| [`POST /v0/todos/:id/duplicate`](#post-v0todosidduplicate)    | Public  | Duplicate a todo via same-domain integration            | [View](./src/handlers/v0/todos/[id]/duplicate/post.ts)      |
| [`GET /v0/headers`](#get-v0headers)                           | Public  | Return resolved common and route-level headers          | [View](./src/handlers/v0/headers/get.ts)                    |
| [`GET /v0/resources`](#get-v0resources)                       | Public  | Return resolved resources (SSM, KMS, Secrets Manager)   | [View](./src/handlers/v0/resources/get.ts)                  |
| [`GET /v0/identity/:service`](#get-v0identityservice)         | Public  | Get identity link using route context pattern           | [View](./src/handlers/v0/identity/[service]/get.ts)         |
| [`GET /v0/identity/:service`](#get-v0identityservice-private) | Private | Get identity link via private route                     | [View](./src/handlers/v0/identity/[service]/get.private.ts) |
| [`PATCH /v0/notifications`](#patch-v0notifications)           | Public  | Update notifications via cross-domain integration       | [View](./src/handlers/v0/notifications/patch.ts)            |

### Services

| Name                                          | Description                                               | Code                                           |
| --------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| [`getIdentityLink`](#getidentitylink)         | Fetch identity link from UDP via gateway integration      | [View](./src/services/get-identity-link.ts)    |
| [`updateNotifications`](#updatenotifications) | Generate push ID and send notification update to upstream | [View](./src/services/update-notifications.ts) |

---

## GET `/v0/todos`

List todos with filtering, pagination and optional metadata. Demonstrates query parameter validation, feature flags and response schema validation.

### SDK Features

- `query`: Query parameters
- `response`: Response schema validation
- `featureFlags`: Feature flags

### Request

| Query Parameter | Type      | Default | Description                       |
| --------------- | --------- | ------- | --------------------------------- |
| `completed`     | `boolean` | —       | Filter by completion status       |
| `priority`      | `string`  | —       | Filter by `low`, `medium`, `high` |
| `limit`         | `number`  | `10`    | Results per page                  |
| `page`          | `number`  | `1`     | Page number                       |

### Response

```json
{
  "todos": [
    {
      "id": "uuid",
      "title": "Todo #1",
      "completed": true,
      "priority": "low",
      "createdAt": "2026-03-29T11:00:00.000Z",
      "meta": {
        "label": "LOW"
      }
    }
  ],
  "total": 1
}
```

> The `meta` field is only included when the `enableTodoMetadata` feature flag is enabled. This flag is scoped to the `development` environment only.

---

## POST `/v0/todos [private]`

Create a new todo. Demonstrates request body validation on a private authenticated route.

### SDK Features

- `auth`: Provides access to the pairwise ID
- `body`: Request schema validation
- `response`: Response schema validation

### Request

```json
{
  "title": "My todo",
  "completed": false,
  "priority": "low"
}
```

> The schema provides default values for `completed` and `priority` fields if omitted.

### Response

```json
{
  "id": "uuid",
  "title": "My todo",
  "completed": false,
  "priority": "low",
  "createdAt": "2026-04-01T11:00:00.000Z"
}
```

---

## GET `/v0/todos/:id`

Get a single todo by ID. Demonstrates path parameters and feature flags.

### SDK Features

- `pathParams`: Path parameters
- `response`: Response schema validation
- `featureFlags`: Feature flags

### Response

```json
{
  "id": "uuid",
  "title": "Todo #1",
  "completed": true,
  "priority": "low",
  "createdAt": "2026-03-29T11:00:00.000Z",
  "meta": {
    "label": "LOW"
  }
}
```

> Returns `404` when the todo does not exist. The `meta` field is only included when the `enableTodoMetadata` feature flag is enabled. This flag is scoped to the `development` environment only.

---

## DELETE `/v0/todos/:id`

Delete a todo by ID. Demonstrates a no-content response.

### SDK Features

- `pathParams`: Path parameters

### Response

- Returns `204` on success without a body
- Returns `404` when the todo does not exist

---

## POST `/v0/todos/:id/duplicate`

Duplicate an existing todo by calling the domain's own `POST /v0/todos` endpoint via the private gateway. Demonstrates same-domain integrations with typed request/response schemas.

### SDK Features

- `pathParams`: Path parameters
- `integrations`: Access to domain integrations
- `resources`: Access to domain resources

### Response

```json
{
  "id": "uuid",
  "title": "Todo #1 (copy)",
  "completed": false,
  "priority": "low",
  "createdAt": "2026-03-29T11:00:00.000Z"
}
```

> Returns `404` when the original todo does not exist. Returns `502` when the upstream integration fails.

---

## GET `/v0/headers`

Return resolved request headers. Demonstrates common headers (defined at domain level) merged with route headers, including all required/optional headers.

### SDK Features

- `headers`: Access to both common and route headers combined

### Response

```json
{
  "requestId": "<value>",
  "correlationId": "<value>",
  "exampleId": "<value>"
}
```

> `x-request-id` is required (returns `400` if missing). `x-correlation-id` and `x-example-id` are both optional with a fallback value of `null` if not provided.

---

## GET `/v0/resources`

Return resolved resource parameters. Demonstrates all four resource types: SSM (deploy time and runtime), KMS and Secrets Manager.

### SDK Features

- `resources`: Access to all available resource types

### Response

```json
{
  "ssm": {
    "deployTimeParam": 50,
    "runtimeParam": 50
  },
  "secret": {
    "secret": 32
  },
  "kms": {
    "key": "arn:aws:kms:"
  }
}
```

> Response contains string lengths and prefixes rather than raw values to verify they exist.

---

## GET `/v0/identity/:service`

Check whether an identity link exists for the authenticated user. Demonstrates route context usage to deeply access handler context and using shared service functionality for common access across multiple public/private routes.

### SDK Features

- `auth`: Access to pairwise ID
- `pathParams`: Path parameters
- `integrations`: Access to domain integrations
- `routeContext`: Accessing handler context outside the route function

### Response

```json
{
  "linked": true
}
```

---

## GET `/v0/identity/:service [private]`

Check whether an identity link exists for a specific user via a custom header. Demonstrates identical functionality to [Public endpoint counterpart](#get-v0identityservice), showing an alternative private access with route-level required headers.

### SDK Features

- `headers`: Provided headers (access and validation)
- `pathParams`: Path parameters (access and validation)
- `response`: Response schema validation
- `integrations`: Access to domain integrations
- `routeContext`: Accessing handler context outside the route function

### Response

```json
{
  "service": "example-service",
  "identifier": "abc123",
  "createdAt": "2026-03-30T11:00:00.000Z"
}
```

> Returns `404` when the identity link does not exist. Returns `400` when the `User-Id` header is missing.

---

## PATCH `/v0/notifications`

Update user notifications in UDP. Demonstrates a service that uses `routeContext` to access resources and integrations outside the handler and also includes upstream gateway calls.

### SDK Features

- `auth`: Authentication (access to pairwise ID and validation)
- `body`: Request schema validation
- `response`: Response schema validation
- `resources`: Access to domain resources
- `integrations`: Access to domain integrations
- `routeContext`: Accessing handler context outside the route function

### Request

```json
{
  "consentStatus": "accepted"
}
```

### Response

```json
{
  "consentStatus": "accepted",
  "pushId": "uuid"
}
```

> Returns `502` when the upstream integration fails.

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
