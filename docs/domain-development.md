# Domain Development Guide

Guide for developers building application code within a FLEX domain.

---

## Overview

| Area           | Description                                       |
| -------------- | ------------------------------------------------- |
| Handlers       | Implement business logic for domain API endpoints |
| Tests          | Write unit/E2E tests for handlers                 |
| Infrastructure | Provision route(s) via domain constructs          |

---

## Prerequisites

Complete the [Environment Setup](/docs/environment-setup.md) before starting domain development.

---

## Available Packages

| Package                                            | Purpose                | When to Use                                                          |
| -------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| [`@flex/handlers`](/libs/handlers/README.md)       | Lambda handler factory | All handlers                                                         |
| [`@flex/logging`](/libs/logging/README.md)         | Structured logging     | When you need logging                                                |
| [`@flex/middlewares`](/libs/middlewares/README.md) | Shared middleware      | When you need to modify the request/response with additional context |
| [`@flex/testing`](/libs/testing/README.md)         | Test fixtures          | All test suites                                                      |
| [`@flex/utils`](/libs/utils/README.md)             | Schemas and utilities  | Validation, schemas, common utilities/types                          |

---

## Domain Handler Development

### Directory Structure

```text
domains/<domain>/
├── src/
│   └── handlers/
│       └── <handler>/
│           ├── <method>.ts
│           └── <method>.test.ts
├── eslint.config.mjs
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

### Domain Handler Patterns

See the [Developer Reference](/docs/developer-reference.md#handler-patterns) for handler implementation patterns:

- [Base Handler](/docs/developer-reference.md#base-handler): Standard handler implementation using `createLambdaHandler`
- [With User Context](/docs/developer-reference.md#with-user-context): Handler behind authentication
- [With Request Validation](/docs/developer-reference.md#with-request-validation): Handler with request body parsing using Zod

---

## Route Provisioning

Each domain has a construct in `platform/infra/flex/src/constructs/` that defines its routes. See the [Developer Reference](/docs/developer-reference.md#route-provisioning) for implementation patterns:

- [Choosing a Lambda Construct](/docs/developer-reference.md#choosing-a-construct): Choose the appropriate construct for your handler(s) requirements
- [Domain Construct](/docs/developer-reference.md#domain-construct): Create the construct and add routes
- [Adding to Stack](/docs/developer-reference.md#adding-to-stack): Instantiate the domain construct in the FLEX infrastructure

---

## Testing

### Unit Tests

Create a test file at `domains/<domain>/src/handlers/<handler>/<method>.test.ts`:

```typescript
import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /path", () => {
  it("returns 200 with data", async ({ event, response }) => {
    const result = await handler(event.get("/path"), context);

    expect(result).toEqual(response.ok({ data: [] }));
  });

  it("returns 400 with error message", async ({ event, response }) => {
    const result = await handler(event.post("/path", { body: {} }), context);

    expect(result).toEqual(
      response.badRequest({ error: "Custom error message" }),
    );
  });
});
```

### E2E Tests

Create a test file at `tests/e2e/src/domains/<domain>.test.ts`.

The `it` fixture from `@flex/testing/e2e` provides two clients: `api` (hits API Gateway directly) and `cloudfront` (hits CloudFront distribution, testing the full ingress path including authentication).

Using the `api` fixture:

```typescript
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("POST /user", () => {
  it("returns 201 and creates a user", async ({ api }) => {
    const result = await api.client.post("/user", {
      body: { name: "John Doe" },
      headers: {
        Authorization: "Bearer test.valid.token",
      },
    });

    expect(result.status).toBe(201);
    expect(result.body).toEqual({
      message: "User created successfully!",
      userId: expect.any(String),
    });
  });
});
```

Using the `cloudfront` fixture:

```typescript
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("GET /example", () => {
  it("returns 200 through CloudFront", async ({ cloudfront }) => {
    const result = await cloudfront.client.get("/example", {
      headers: {
        Authorization: "Bearer test.valid.token",
      },
    });

    expect(result.status).toBe(200);
    expect(result.headers.get("x-rejected-by")).toBeUndefined();
    expect(result.body).toEqual({ message: "Hello World!" });
  });
});
```

### Running Tests

```bash
# Run tests for a specific workspace
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

1. Create directory structure in `domains/<domain>/`
2. Create `package.json`, config files and initial handlers
3. Create construct in `platform/infra/flex/src/constructs/<domain>.ts`
4. Instantiate domain in `platform/infra/flex/src/stack.ts`
5. Create `README.md` using the [FLEX Domain template](/docs/documentation-guide.md#flex-domain)

### Adding a New Domain Handler

1. Create handler file at `domains/<domain>/src/handlers/<handler>/<method>.ts`
2. Create test file at `domains/<domain>/src/handlers/<handler>/<method>.test.ts`
3. Run tests locally with `pnpm --filter @flex/<domain>-domain test`
4. Add route(s) to domain construct in `platform/infra/flex/src/constructs/<domain>.ts`
5. Deploy and verify by running E2E tests with `pnpm --filter @flex/e2e test:e2e`

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/middlewares](/libs/middlewares/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Environment Setup](/docs/environment-setup.md)
- [Platform Development Guide](/docs/platform-development.md)
- [Deployment Guide](/docs/deployment.md)
- [Developer Reference](/docs/developer-reference.md)
- [Documentation Guide](/docs/documentation-guide.md)
