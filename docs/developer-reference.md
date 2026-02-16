# Developer Reference

Common patterns, best practices and workflows when developing on FLEX.

---

## Handler Patterns

All Lambda handlers use `createLambdaHandler` from `@flex/handlers`.

See [@flex/handlers](/libs/handlers/README.md) for full API documentation.

### Base Handler

```typescript
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (event) => {
    const logger = getLogger();

    // Business logic

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Success" }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "service-name",
  },
);
```

### With User Context

For handlers behind authentication that need the user's pairwise ID:

```typescript
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import type { ContextWithPairwiseId, V2Authorizer } from "@flex/middlewares";
import { extractUser } from "@flex/middlewares";
import type {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2,
  ContextWithPairwiseId
>(
  async (event, context) => {
    const logger = getLogger();

    const userId = context.pairwiseId;

    return {
      statusCode: 200,
      body: JSON.stringify({ userId }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "service-name",
    middlewares: [extractUser],
  },
);
```

### With Request Validation

For handlers that need to validate incoming requests:

```typescript
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";

const RequestBodySchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (event) => {
    const logger = getLogger();

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
    serviceName: "service-name",
  },
);
```

---

## Lambda Constructs

### Choosing a Construct

| Construct                     | Internet Access | VPC Resources | Use Case                              |
| ----------------------------- | --------------- | ------------- | ------------------------------------- |
| `FlexPublicFunction`          | Yes             | No            | Simple handlers, public APIs          |
| `FlexPrivateEgressFunction`   | Yes (NAT)       | Yes           | Calling external APIs + VPC resources |
| `FlexPrivateIsolatedFunction` | No              | Yes           | Internal processing                   |

```text
Does your handler need to call external APIs?
├── Yes → FlexPrivateEgressFunction
└── No
    └── Does your handler need VPC resources?
        ├── Yes → FlexPrivateIsolatedFunction
        └── No → FlexPublicFunction
```

### Creating a Lambda Function

```typescript
import { FlexPublicFunction } from "./constructs/flex-public-function";
import { FlexPrivateEgressFunction } from "./constructs/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "./constructs/flex-private-isolated-function";
import { getDomainEntry } from "./utils/getEntry";

const publicFunction = new FlexPublicFunction(this, "PublicFunction", {
  entry: getDomainEntry("domain", "handlers/public/get.ts"),
  domain: "domain",
});

const privateFunction = new FlexPrivateEgressFunction(this, "PrivateFunction", {
  entry: getDomainEntry("domain", "handlers/private/get.ts"),
  domain: "domain",
});

const isolatedFunction = new FlexPrivateIsolatedFunction(
  this,
  "IsolatedFunction",
  {
    entry: getDomainEntry("domain", "handlers/isolated/get.ts"),
    domain: "domain",
  },
);
```

### Entry Point Helpers

Use `getDomainEntry` for domain handlers and `getPlatformEntry` for platform handlers:

```typescript
import { getDomainEntry, getPlatformEntry } from "./utils/getEntry";

// Domain handler: domains/domain/src/handlers/handler/method.ts
getDomainEntry("domain", "handlers/handler/method.ts");

// Platform handler: platform/domains/domain/src/handler.ts
getPlatformEntry("domain", "handler.ts");
```

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
- [Domain Development Guide](/docs/domain-development.md)
- [Deployment Guide](/docs/deployment.md)
- [Documentation Guide](/docs/documentation-guide.md)
