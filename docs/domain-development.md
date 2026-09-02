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
│   ├── handlers/
│   │   └── <version>/
│   │       └── /<resource>
│   │           ├── <method>.ts
│   │           ├── <method>.test.ts
│   │           ├── <method>.private.ts
│   │           └── <method>.private.test.ts
│   └── tests/
│       └── setup.ts
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
  environments: ["development", "staging", "production"],
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

> `environments` declares which environments can be deployed to and which should be gated. All domains must define this explicitly, given there is no fallback value to default to.

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

export const handler = route(
  "POST /v1/path [private]",
  async ({ auth, logger }) => {
    const { pairwiseId } = auth;

    logger.info("Authenticated user", { userId: auth.pairwiseId });

    return {
      status: 200,
      data: { userId: pairwiseId },
    };
  },
);
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

Any route that references domain integrations will include `integrations` on the context. Integrations are typed HTTP clients for calling other domains and service gateways through the FLEX private gateway.

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
  const pushId = getNotificationId();
  const preferences = await getUserPreferences();

  // You can call `routeContext` directly if you prefer not to create aliases
  const context = routeContext<"GET /v1/user">();

  return {
    status: 200,
    data: { userId: auth.pairwiseId, pushId, preferences },
  };
});

function getNotificationId() {
  const { auth, resources } = getUserContext();

  return crypto
    .createHmac("sha256", resources.udpNotificationSecret)
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
const pushId = getNotificationId(); // throws
```

> Route context is only accessible during handler execution. Any attempt to call it outside a route's execution context will throw an error. See [AsyncLocalStorage](https://nodejs.org/docs/latest-v24.x/api/async_context.html#asynclocalstoragegetstore)

#### Error Responses

Every error the platform returns uses a single JSON contract (`ErrorResponse` in `@flex/utils`):

```jsonc
{
  "message": "string",
  "type": "auth_error | validation_error | client_error | server_error",
  "errors": [{ "field": "query.page", "message": "Expected number" }] // optional
}
```

Authentication failures (from the CloudFront Function or the Lambda authorizer) always return `{ "message": "Unauthorized", "type": "auth_error" }`, identical for every reason, so the response cannot reveal why auth failed. Request validation failures return `type: "validation_error"` with an `errors` array. You do not build these bodies yourself — the SDK produces them when validation throws or a handler throws an `http-errors` error. See the [SDK error response contract](/libs/sdk/README.md#error-response-contract).

---

## Testing

### Overview

Handler tests run the full SDK workflow that includes:

- Registering route middleware
- Constructing the route context and providing it to the handler
- Transforming responses
- Error handling

Every test file imports the extended `it` from [`@flex/testing`](/libs/testing/README.md), which supplies four fixtures:

| Fixture    | Purpose                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `env`      | Stubs environment variables for a single test                                                           |
| `http`     | Intercepts outbound calls to domains and gateways                                                       |
| `sdk`      | Builds domain handler events and Lambda context                                                         |
| `platform` | Builds platform handler events and Lambda context (authorizers, CloudFront Functions, service gateways) |

Domain handler tests use `http` and `sdk`. Platform domain handlers and service gateways use `http` and `platform` instead, see [Platform Development Guide: Testing](/docs/platform-development.md#testing).

### Setup

Every domain using `@flex/sdk` requires three things:

1. Set up domain Vitest configuration (`vitest.config.ts`)

Each domain needs to register its own test configuration, which needs to be merged with the Flex managed Vitest configuration.

This allows each domain to do all of the following:

- Inject the SDK setup file
- Provide its own domain setup file, if needed
- Inject environment variables for use across each test suite
- Exclude E2E tests

```typescript
import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: [
        "@flex/testing/setup/sdk",
        // If you need to provide your own domain setup file
        // "./src/tests/setup.ts"
      ],
      env: {
        AWS_REGION: "eu-west-2",
        exampleKey: "arn:aws:kms:eu-west-2:123456789012:key/test-key",
        gatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        mySecret: "/path/to/name",
      },
    },
  }),
);
```

Deploy-time resources (e.g. `"kms"`, `"ssm"`, etc) must be defined here so they're available when the handler module loads.

### Mocking Resources

| Resource        | Location                   | Fixture                                      |
| --------------- | -------------------------- | -------------------------------------------- |
| `"kms"`         | `env` (`vitest.config.ts`) | —                                            |
| `"ssm"`         | `env` (`vitest.config.ts`) | —                                            |
| `"secret"`      | `sdk` fixture              | `sdk.context({ secrets: { key: "value" } })` |
| `"ssm:runtime"` | `sdk` fixture              | `sdk.context({ params: { key: "value" } })`  |

By default resources are baked into `process.env`. Any resources that you know need to be resolved via middleware (secrets, or SSM parameters resolved at runtime) are instead supplied to `sdk.context()` via `secrets` and `params`.

### Writing your First Handler Test

Create the test file based on the route access:

- Public handlers: `domains/<domain>/src/handlers/v1/<...path>/<method>.test.ts`
- Private handlers: `domains/<domain>/src/handlers/v1/<...path>/<method>.private.test.ts`

Outbound calls are intercepted with the `http` fixture, where the prefix is determined by whether you target a `domain(<target>)` or `gateway(<target>)`:

```typescript
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/users/notifications", () => {
  const endpoint = "/users/notifications";
  const userId = "test-user-id";

  it("returns 200 with notifications", async ({ http, sdk }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId: "test-push-id" });
    http
      .gateway("uns")
      .get("/notifications", { query: { externalUserID: "test-push-id" } })
      .reply(200, []);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
  });
});
```

> `http.gateway("udp")` and `http.domain("udp")` both stub requests to the private gateway's `/gateways/udp` and `/domains/udp` prefixes, matching whichever integration type the handler calls through. The `http` fixture must match the URL the domain declares for its private gateway resource (E.g., `gatewayUrl`, `flexPrivateGatewayUrl`, etc). See the [`http` fixture](/libs/testing/README.md) for the full API reference.

Build the request with `sdk.event`, which exposes common HTTP methods (`get`, `post`, `put`, `patch`, `delete`), each taking a path and options (`auth`, `headers`, `params`, `query`, `body`). Pass `auth` with a user ID to simulate an authenticated caller which populates the `auth.pairwiseId` on the handler context. Alternative authentication methods exist, such as a route reading a `User-Id` header; in this case, provide the mocked value via `headers` instead.

#### Handlers with runtime resources

Routes that reference `type: "secret"` or `type: "ssm:runtime"` resources are resolved internally by the handler middleware and injected onto the Lambda context. You can provide values for these fields via `sdk.context()`:

```typescript
const result = await handler(
  sdk.event.get(endpoint, { auth: "test-user-id" }),
  sdk.context({
    secrets: { mySecret: "test-secret-value" }, // pragma: allowlist secret
    params: { myParam: "test-param-value" },
  }),
);
```

### E2E Tests

E2E tests verify deployed handlers through the full request flow. Create a test file at `tests/e2e/src/domains/<domain>.test.ts`.

#### Setup

E2E tests use the `@flex/testing/e2e` extended `it` function:

| Fixture          | Description                             |
| ---------------- | --------------------------------------- |
| `cloudfront`     | HTTP client via CloudFront              |
| `privateGateway` | HTTP client for the private API gateway |

| Token         | Description                  |
| ------------- | ---------------------------- |
| `JWT.VALID`   | Valid authentication token   |
| `JWT.INVALID` | Invalid authentication token |

#### Writing E2E Tests

```typescript
import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("Example Domain", () => {
  const { JWT } = inject("e2eEnv");

  describe("GET /v1/resource", () => {
    const endpoint = "/v1/resource";

    it("rejects unauthenticated requests", async ({ cloudfront }) => {
      const result = await cloudfront.client.get(endpoint);

      expect(result.status).toBe(401);
      expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
    });

    it("returns 200 with data", async ({ cloudfront }) => {
      const result = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        // expected data
      });
    });
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

# Run this domain's E2E tests against your personal environment
pnpm --filter @flex/<domain>-domain test:e2e

# Run this domain's E2E tests against a specific environment
STAGE=development pnpm --filter @flex/<domain>-domain test:e2e
```

> Domain E2E tests live in `domains/<domain>/e2e/` and run via the domain's
> `test:e2e` script. CI discovers every domain that declares a `test:e2e`
> script and runs it as its own non-blocking `Module E2E (<domain>)` check.

---

## Common Tasks

### Adding a New Domain

1. Create the [directory structure](#directory-structure) in `domains/<domain>/`
2. Define domain configuration in `domain.config.ts`
3. Update `vitest.config.ts`
   1. Add SDK setup file
   2. (Optional) Add a local setup file (`src/tests/setup.ts`) if you need to define your own setup/teardown steps specific to the workspace
   3. Add environment variables
   4. Exclude E2E tests from the unit run (`exclude: [...configDefaults.exclude, "e2e/**"]`)
4. (Optional) Add E2E tests in `e2e/`, a `vitest.e2e.config.ts`, and a `test:e2e` script so the domain is picked up by the CI module E2E matrix
5. Define route handler(s)
6. Create `README.md`
7. Deploy (`pnpm run deploy`) and verify (`pnpm --filter @flex/<domain>-domain test:e2e`)

> The platform will [automatically include the new domain](/platform/infra/flex/src/utils/getDomainConfigs.ts) for deployment, no manual wiring is necessary.

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
