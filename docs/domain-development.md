# Domain Development Guide

Guide for developers building application code within a FLEX domain.

---

## Overview

Domain developers build handlers that implement business logic for a specific domain. Your code lives in `domains/<name>/` and uses shared packages provided by the platform.

### Responsibilities

- Implement handlers for your domain's API endpoints
- Write tests for your handlers
- Follow patterns established by the platform
- Provision routes via a domain construct in `platform/infra/flex/`

---

## Available Packages

| Package                                              | Purpose                | When to Use                                                          |
| ---------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| [`@flex/handlers`](../libs/handlers/README.md)       | Lambda handler factory | Every handler                                                        |
| [`@flex/logging`](../libs/logging/README.md)         | Structured logging     | When you need logging                                                |
| [`@flex/middlewares`](../libs/middlewares/README.md) | Shared middleware      | When you need to modify the request/response with additional context |
| [`@flex/testing`](../libs/testing/README.md)         | Test fixtures          | Every test file                                                      |
| [`@flex/utils`](../libs/utils/README.md)             | Schemas and utilities  | Validation, schemas, common utilities                                |

---

## Example: Adding a Handler

### 1. Create handler file

Create a new file at `domains/<domain>/src/handlers/<handler-name>/<method>.ts`

```typescript
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { exampleFlexMiddleware } from "@flex/middlewares";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { exampleDomainMiddleware } from "../../middlewares";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (event) => {
    const logger = getLogger();

    // Business logic & logging

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Success" }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "<domain>-<name>-service",
    // (Optional) add custom middleware (FLEX or provide your own domain middlewares)
    middlewares: [exampleFlexMiddleware, exampleDomainMiddleware],
  },
);
```

### 2. Create test file

Create a new file at `domains/<domain>/src/handlers/<handler-name>/<method>.test.ts`:

```typescript
import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./<method>";

describe("<METHOD> /path", () => {
  it("returns 200", async ({ event, response }) => {
    const result = await handler(event.get("/path"), context);

    expect(result).toEqual(
      response.ok({
        // Assert expected response
      }),
    );
  });
});
```

### 3. Run tests locally

```bash
# Run from the root
pnpm --filter @flex/<domain>-domain test

# Run from domain workspace
pnpm test
```

### 4. Provision the route

See [Example: Provisioning Routes](#example-provisioning-routes).

---

## Example: Provisioning Routes

Each domain has its own construct in `platform/infra/flex/src/constructs/` that defines its routes. To add a new route, either create a new domain construct or update the existing construct to include the new route(s).

### Adding a route to an existing domain

Update the domain construct in `platform/infra/flex/src/constructs/<domain>.ts`:

```typescript
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "./flex-private-isolated-function";
import { RouteGroup } from "./flex-route-group";

export class ExampleDomain extends Construct {
  constructor(scope: Construct, id: string, routeGroup: RouteGroup) {
    super(scope, id);

    // Existing routes...

    // Add your new route(s)
    const exampleHandler = new FlexPrivateIsolatedFunction(
      this,
      "ExampleFunction",
      {
        entry: getEntry("udp", "handlers/example/post.ts"),
        domain: "udp",
      },
    );

    routeGroup.addRoute(
      "/path",
      HttpMethod.POST,
      new HttpLambdaIntegration("ExampleHandler", exampleHandler.function),
    );
  }
}
```

### Creating a new domain construct

If your domain doesn't have a construct yet:

1. Create the construct file:

```text
platform/infra/flex/src/constructs/<domain>.ts
```

2. Follow the pattern above, using the appropriate Lambda construct type for each new route.

3. Instantiate the domain in the stack (`platform/infra/flex/src/stack.ts`) and pass through the route group to assign the routes to the existing API:

```typescript
import { YourDomain } from "./constructs/your-domain";

const v1 = new RouteGroup(this, "V1", {
  httpApi,
  pathPrefix: "/1.0/app",
});

new UdpDomain(this, "UdpDomain", v1);
```

---

## Choosing the Correct Lambda Construct

When provisioning routes, choose the appropriate Lambda construct for your domain needs:

```text
Does your handler need to call external APIs?
├── Yes → FlexPrivateEgressFunction
└── No
    └── Does your handler need VPC resources?
        ├── Yes → FlexPrivateIsolatedFunction
        └── No → FlexPublicFunction
```

| Construct                     | Internet Access | VPC Resources | Use Case                              |
| ----------------------------- | --------------- | ------------- | ------------------------------------- |
| `FlexPublicFunction`          | Yes             | No            | Simple handlers, public APIs          |
| `FlexPrivateEgressFunction`   | Yes (via NAT)   | Yes           | Calling external APIs + VPC resources |
| `FlexPrivateIsolatedFunction` | No              | Yes           | Internal processing                   |

---

## Handler Patterns

### With User Context

For handlers behind authentication that need the user's pairwise ID, use the `extractUser` middleware from `@flex/middlewares`:

```typescript
import type {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";

import { createLambdaHandler } from "@flex/handlers";
import type { ContextWithPairwiseId, V2Authorizer } from "@flex/middlewares";
import { extractUser } from "@flex/middlewares";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2,
  ContextWithPairwiseId
>(
  async (event, context: ContextWithPairwiseId) => {
    const userId = context.pairwiseId;

    return {
      statusCode: 200,
      body: JSON.stringify({ userId }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "<domain>-<name>-service",
    middlewares: [extractUser],
  },
);
```

### With Request Validation

```typescript
import { z } from "zod/v4";

const RequestBodySchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (event) => {
    const parseResult = RequestBodySchema.safeParse(event.body);

    if (!parseResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid request body" }),
      };
    }

    const { name, email } = parseResult.data;

    return {
      statusCode: 201,
      body: JSON.stringify({ name, email }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "my-service",
  },
);
```

---

## Testing

See [@flex/testing](../libs/testing/README.md) for complete fixture documentation.

### Quick Reference

```typescript
import { context, event, it, response } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /resource", () => {
  // Using base imports
  it("returns 200", async () => {
    const result = await handler(event, context);

    expect(result).toEqual(response.ok);
  });

  // Using fixtures for customisation
  it("returns 200 with custom body", async ({ event, response }) => {
    const result = await handler(event.get("/resource"), context);

    expect(result).toEqual(response.ok({ data: [] }));
  });

  // Testing error cases
  it("returns 400 for invalid input", async ({ event, response }) => {
    const result = await handler(
      event.post("/resource", { body: { invalid: true } }),
      context,
    );

    expect(result).toEqual(
      response.badRequest({ error: "Invalid request body" }),
    );
  });
});
```

---

## Directory Structure

```text
domains/<your-domain>/
├── src/
│   └── handlers/
│       └── <handler-name>/
│           ├── <method>.ts
│           ├── <method>.test.ts
├── eslint.config.mjs
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Related

**Workspaces:**

- [@flex/handlers](../libs/handlers/README.md)
- [@flex/logging](../libs/logging/README.md)
- [@flex/middlewares](../libs/middlewares/README.md)
- [@flex/testing](../libs/testing/README.md)
- [@flex/utils](../libs/utils/README.md)
- [@platform/flex](../platform/infra/flex/README.md)

**Other Guides:**

- [Platform Development Guide](platform-development.md)
- [Documentation Guide](documentation-guide.md)
