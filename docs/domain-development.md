# Domain Development Guide

Guide for developers building application code within a FLEX domain.

---

## Overview

| Area     | Description                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Config   | Declare resources, integrations, routes and common options                                                    |
| Handlers | Implement business logic using the `route` handler and access handler context externally using `routeContext` |
| Tests    | Write unit and E2E tests for handlers                                                                         |

---

## Prerequisites

Complete the [Environment Setup](/docs/environment-setup.md) before starting domain development.

---

## Available Packages

| Package                                    | Purpose              | When to Use                        |
| ------------------------------------------ | -------------------- | ---------------------------------- |
| [`@flex/sdk`](/libs/sdk/README.md)         | Domain configuration | All domains                        |
| [`@flex/logging`](/libs/logging/README.md) | Structured logging   | Provided automatically via context |
| [`@flex/testing`](/libs/testing/README.md) | Test fixtures        | All test suites                    |
| [`@flex/utils`](/libs/utils/README.md)     | Schemas and types    | Validation, schemas, common types  |

---

## Domain Development

### Directory Structure

```text
domains/<domain>/
├── domain.config.ts
├── src/
│   └── handlers/
│       └── v1/
│           └── /<resource>
│               ├── <method>.ts
│               ├── <method>.test.ts
│               ├── <method>.private.ts
│               └── <method>.private.test.ts
├── eslint.config.mjs
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

Handler files follow a naming convention derived from the route definition:

| Route definition         | Access  | File path                                        |
| ------------------------ | ------- | ------------------------------------------------ |
| `GET /v1/user`           | public  | `src/handlers/v1/user/get.ts`                    |
| `GET /v1/user/:userId`   | public  | `src/handlers/v1/user/[userId]/get.ts`           |
| `POST /v1/user`          | private | `src/handlers/v1/user/post.private.ts`           |
| `PATCH /v1/user/:userId` | private | `src/handlers/v1/user/[userId]/patch.private.ts` |

The platform will always derive file paths from the route definition, so there is no need to explicitly register handler paths.

### Domain Configuration

Every domain must define a `domain.config.ts` at its root. This is the single source of truth for the domain's routes, resources, integrations and handler options:

```typescript
import { domain } from "@flex/sdk";
import {
  createUserRequestSchema,
  getUserResponseSchema,
} from "@flex/udp-domain";

export const { config, route, routeContext } = domain({
  name: "my-domain",
  common: {
    function: { timeoutSeconds: 30 },
    // add common route options...
  },
  resources: {
    exampleKey: { type: "kms", path: "/path/to/key" },
    gatewayUrl: { type: "ssm", path: "/path/to/url", scope: "stage" },
    exampleSecret: { type: "secret", path: "/path/to/secret" },
  },
  integrations: {
    udpRead: { type: "gateway", target: "udp", route: "GET /v1/*" },
    udpWrite: { type: "gateway", target: "udp", route: "POST /v1/*" },
  },
  routes: {
    v1: {
      "/user": {
        GET: {
          public: {
            name: "get-user",
            resources: ["exampleKey", "gatewayUrl", "exampleSecret"],
            integrations: ["udpRead", "udpWrite"],
            response: getUserResponseSchema,
          },
        },
        POST: {
          private: {
            name: "create-user",
            resources: ["gatewayUrl"],
            integrations: ["udpWrite"],
            body: createUserRequestSchema,
          },
        },
      },
    },
  },
});

// Example: Create alias accessors for reuse throughout your domain
export const getUserContext = routeContext<"GET /v1/user">;
export const createUserContext = routeContext<"POST /v1/user [private]">;
```

The Flex platform will read the contents of `config` to provision the domain stack and its resources.

See [@flex/sdk](/libs/sdk/README.md) for full API documentation on how to configure your domain.

---

### Handler Patterns

All handlers are created using the `route()` function exported from `domain.config.ts`. The context object is conditionally typed based on the configuration for the route.

#### Base Handler

```typescript
import { route } from "path/to/domain.config";

export const handler = route("GET /v1/path", async (context) => {
  return {
    status: 200,
    data: { message: "Hello" },
  };
});
```

#### With Logging

All routes include a `logger` instance on the context:

```typescript
import { route } from "path/to/domain.config";

export const handler = route("GET /v1/path", async ({ logger }) => {
  logger.info("Handling request...");

  return {
    status: 200,
    data: { message: "Hello" },
  };
});
```

#### With Authentication

All private and non-public access routes will include `auth` on the context:

```typescript
import { route } from "path/to/domain.config";

export const handler = route("POST /v1/path [private]", async ({ auth, logger }) => {
  const { pairwiseId } = auth;

  logger.info("Authenticated user", { userId: auth.pairwiseId });

  return {
    status: 200,
    data: { userId: pairwiseId },
  };
});
```

#### With Request Body

Any route that defines a `body` schema will include `body` on the context. The SDK validates the request body before the handler runs, so the context will always contain validated and typed data:

Domain config (`domain.config.ts`):

```typescript
import { domain } from "@flex/sdk";

export const { route } = domain({
  routes: {
    v1: {
      "/user": {
        PATCH: {
          public: {
            name: "update-user",
            body: updateUserRequestSchema,
          },
        },
      },
    },
  },
});
```

Handler (`domains/<domain>/src/handlers/<version>/<...path>/<method>.ts`):

```typescript
import { route } from "path/to/domain.config";

export const handler = route("PATCH /v1/user", async ({ body, logger }) => {
  // body is validated and typed as `updateUserSchema` (Zod inferred type)
  logger.info("Updating user", { user: body });

  return { status: 204 };
});
```

#### With Path Parameters

Any route with `:param` segments in the path will include `pathParams` on the context:

Domain config (`domain.config.ts`):

```typescript
import { domain } from "@flex/sdk";

export const { route } = domain({
  routes: {
    v1: {
      "/user/:userId": {
        GET: {
          public: {
            name: "get-user-by-id",
          },
        },
      },
    },
  },
});
```

Handler (`domains/<domain>/src/handlers/<version>/<...path>/<method>.ts`):

```typescript
import { route } from "path/to/domain.config";

export const handler = route(
  "GET /v1/user/:userId",
  async ({ logger, pathParams }) => {
    logger.info("Fetching user", { userId: pathParams.userId });

    return {
      status: 200,
      data: { userId: pathParams.userId },
    };
  },
);
```

#### With Query Parameters

Any route that defines a `query` schema will include `queryParams` on the context. The SDK validates query parameters before the handler runs:

Domain config (`domain.config.ts`):

```typescript
import { domain } from "@flex/sdk";

export const { route } = domain({
  routes: {
    v1: {
      "/user": {
        GET: {
          public: {
            name: "list-users",
            query: listUsersQuerySchema, // includes: limit, page
          },
        },
      },
    },
  },
});
```

Handler (`domains/<domain>/src/handlers/<version>/<...path>/<method>.ts`):

```typescript
import { route } from "path/to/domain.config";

export const handler = route(
  "GET /v1/user",
  async ({ logger, queryParams }) => {
    // queryParams is validated and typed as listUsersQuerySchema (Zod inferred type)
    const { limit, page } = queryParams;

    logger.info("List users", { page, limit });

    return {
      status: 200,
      data: { page, results: [] },
    };
  },
);
```

#### With Resources

Any route that references domain resources will include `resources` on the context. SDK automatically resolves resource values, whether they are resolved at deploy time or via middleware:

Domain config (`domain.config.ts`):

```typescript
import { domain } from "@flex/sdk";

export const { route } = domain({
  resources: {
    exampleKey: { type: "kms", path: "/path/to/key" },
    exampleSecret: { type: "secret", path: "/path/to/secret" },
  },
  routes: {
    v1: {
      "/user": {
        GET: {
          public: {
            name: "get-user",
            resources: ["exampleKey", "exampleSecret"],
          },
        },
      },
    },
  },
});
```

Handler (`domains/<domain>/src/handlers/<version>/<...path>/<method>.ts`):

```typescript
import { route } from "path/to/domain.config";

export const handler = route("GET /v1/user", async ({ logger, resources }) => {
  const { exampleKey, exampleSecret } = resources;

  logger.info("List resources", { arn: exampleKey, hash: exampleSecret });

  return { status: 200 };
});
```

See [SDK Resources](/libs/sdk/README.md#resources) for all resource types and options.

#### With Integrations

Any route that references domain integrations will include `integrations` on the context. Integrations are typed HTTP clients for calling other domains through the FLEX private gateway:

Domain config (`domain.config.ts`):

```typescript
import { domain } from "@flex/sdk";

export const { route } = domain({
  resources: {
    gatewayUrl: { type: "ssm", path: "/path/to/url", scope: "stage" },
  },
  integrations: {
    udpRead: { type: "gateway", target: "udp", route: "GET /v1/*" },
    udpPatchUser: {
      type: "domain",
      target: "udp",
      route: "PATCH /v1/user",
      body: requestSchema,
      response: responseSchema,
    },
  },
  routes: {
    v1: {
      "/user": {
        PATCH: {
          public: {
            name: "update-preferences",
            resources: ["gatewayUrl"],
            integrations: ["udpRead", "udpPatchUser"],
            body: requestSchema,
          },
        },
      },
    },
  },
});
```

Handler (`domains/<domain>/src/handlers/<version>/<...path>/<method>.ts`):

```typescript
import { route } from "path/to/domain.config";

export const handler = route(
  "PATCH /v1/user",
  async ({ auth, body, integrations, logger }) => {
    // Typed body and response (result.data) inferred from config
    const result = await integrations.udpPatchUser({
      body,
      headers: { "requesting-service-user-id": auth.pairwiseId },
    });

    if (!result.ok) {
      const { body, status } = result.error;

      logger.error("Failed to update preferences", { status, body });

      throw new createHttpError.BadGateway();
    }

    return {
      status: 200,
      data: result.data,
    };
  },
);
```

See [SDK Integrations](/libs/sdk/README.md#integrations) for integration types, patterns and options.

#### With Headers

Any route that declares headers will include `headers` on the context. Route headers merge with common headers, with route-level values taking precedence. Missing required headers return an automatic 400 response:

Domain config (`domain.config.ts`):

```typescript
import { domain } from "@flex/sdk";

export const { route } = domain({
  common: {
    headers: {
      traceId: { name: "x-trace-id", required: false },
    },
  },
  routes: {
    v1: {
      "/user": {
        PATCH: {
          private: {
            name: "update-user",
            headers: {
              userId: { name: "requesting-service-user-id" },
            },
            body: updateUserRequestSchema,
          },
        },
      },
    },
  },
});
```

Handler (`domains/<domain>/src/handlers/<version>/<...path>/<method>.ts`):

```typescript
import { route } from "path/to/domain.config";

export const handler = route(
  "PATCH /v1/user [private]",
  async ({ body, headers, logger }) => {
    // Headers typed as:
    // - userId: string
    // - traceId: string | undefined
    const { traceId, userId } = headers;

    logger.info("Route headers", { userId, traceId });

    return { status: 200 };
  },
);
```

See [SDK Headers](/libs/sdk/README.md#headers) for header configuration options.

#### With Route Context

Use `routeContext` to access a route's context outside of the handler:

```typescript
import { getUserContext, route, routeContext } from "path/to/domain.config";

export const handler = route("GET /v1/user", async ({ auth, logger }) => {
  // Helpers access context via routeContext and are valid because they are called inside AsyncLocalStorage scope
  const notificationId = getNotificationId();
  const preferences = await getUserPreferences();

  // You can call `routeContext` directly if you prefer not to create aliases
  const context = routeContext<"GET /v1/user">();

  return {
    status: 200,
    data: { userId: auth.pairwiseId, notificationId, preferences },
  };
});

function getNotificationId() {
  const { auth, resources } = getUserContext();

  return crypto
    .createHmac("sha256", resources.notificationSecret)
    .update(auth.pairwiseId)
    .digest("base64url");
}

async function getUserPreferences() {
  const { auth, integrations } = getUserContext();

  return await integrations.udpRead<ResponseSchema>({
    path: "/notifications",
    headers: { "requesting-service-user-id": auth.pairwiseId },
  });
}

// ERROR: Called at module scope so will throw as it is outside handler execution and cannot access AsyncLocalStorage context
const { auth, integrations } = getUserContext(); // throws
const notificationId = getNotificationId(); // throws
```

> Route context is only accessible during handler execution. Any attempt to call it outside a route's execution context will throw an error. See [AsyncLocalStorage](https://nodejs.org/docs/latest-v24.x/api/async_context.html#asynclocalstoragegetstore)

---

## Testing (WIP)

### Unit Tests

Create a test file alongside the handler:

- Public handlers: `domains/<domain>/src/handlers/v1/<...path>/<method>.test.ts`:
- Private handlers: `domains/<domain>/src/handlers/v1/<...path>/<method>.private.test.ts`:

```typescript
import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

// Mock dependencies...

describe("GET /v1/user", () => {
  it("returns 200 with user", async ({ event, response }) => {
    // TODO

    expect(result).toEqual(
      response.ok({
        data: {
          // expected
        },
      }),
    );
  });
});
```

### E2E Tests

Create a test file at `tests/e2e/src/domains/<domain>.test.ts`.

```typescript
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("Domain", () => {
  const { JWT } = inject("e2eEnv");

  const endpoint = `/v1/user`;

  it("returns XXX and expected response", async ({ cloudfront }) => {
    // TODO
  });
});
```

### Running Tests

```bash
# Run tests for a specific domain
pnpm --filter @flex/<domain>-domain test

# Run tests with coverage
pnpm --filter @flex/<domain>-domain test --coverage

# Run tests in watch mode
pnpm --filter @flex/<domain>-domain test --watch

# Run E2E tests against your personal environment
pnpm --filter @flex/e2e test:e2e

# Run E2E tests against a specific environment
STAGE=development pnpm --filter @flex/e2e test:e2e
```

---

## Common Tasks

### Adding a New Domain

1. Create the [directory structure](#directory-structure) in `domains/<domain>/`
2. Define the domain configuration in `domain.config.ts`
3. Define handlers in `src/handlers/*`
4. Create `README.md` using the [FLEX Domain template](/docs/documentation-guide.md#flex-domain)
5. Deploy the domain `pnpm run deploy` and verify tests `pnpm --filter @flex/e2e test:e2e`

> The platform will [automatically include the new domain](platform/infra/flex/src/utils/getDomainConfigs.ts) for deployment, no manual wiring is necessary.

### Adding a Handler to an Existing Domain

1. Add the route to `domain.config.ts` under the appropriate version, path and method
2. Set route options and include references to resources/integrations that are needed
3. Create handler file following the [naming convention](#directory-structure)
4. Create test file alongside the handler
5. Run tests locally with `pnpm --filter @flex/<domain>-domain test`
6. Deploy and verify with E2E tests

### Deploying a Single Domain

```bash
domain=<domain_name> pnpm run deploy
```

---

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Environment Setup](/docs/environment-setup.md)
- [Platform Development Guide](/docs/platform-development.md)
- [Deployment Guide](/docs/deployment.md)
- [Developer Reference](/docs/developer-reference.md)
- [Documentation Guide](/docs/documentation-guide.md)
