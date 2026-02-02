# @flex/handlers

Lambda handler utilities and factories for FLEX.

---

## Commands

Run these from the repository root:

| Command                             | Description    |
| ----------------------------------- | -------------- |
| `pnpm --filter @flex/handlers lint` | Lint files     |
| `pnpm --filter @flex/handlers test` | Run tests      |
| `pnpm --filter @flex/handlers tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `libs/handlers/`.

## API

| Name                                          | Description                                                | Code                                 |
| --------------------------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| [`createLambdaHandler`](#createlambdahandler) | Factory for creating Lambda handlers with Middy middleware | [View](./src/createLambdaHandler.ts) |

### Types

| Name                  | Description                                                    | Code                                 |
| --------------------- | -------------------------------------------------------------- | ------------------------------------ |
| `LambdaHandlerConfig` | Configuration options for creating a Lambda handler with middy | [View](./src/createLambdaHandler.ts) |

---

## `createLambdaHandler`

Creates a Lambda handler wrapped with Middy middleware for logging, error handling and request processing.

All handlers automatically include the following middlewares:

| Middleware | Purpose                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Logging    | Injects a logger singleton instance via AWS Lambda Powertools that is cached for the Lambda runtime lifetime. |

### Usage

```typescript
import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (event) => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Hello" }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "service-name",
  },
);
```

#### With Logging

Access the logger via `@flex/logging`:

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

    logger.info("Handling request", { path: event.rawPath });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Hello" }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "service-name",
  },
);
```

#### With Middleware

Use middleware from `@flex/middlewares` or define your own custom middleware:

```typescript
import { createLambdaHandler } from "@flex/handlers";
import type { ContextWithPairwiseId } from "@flex/middlewares";
import { extractUser } from "@flex/middlewares";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

const customMiddleware: MiddlewareObj<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
> = {
  before: () => {
    // middleware logic
  },
  after: () => {
    // middleware logic
  },
};

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  ContextWithPairwiseId
>(
  async (event, context) => {
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "User created successfully!",
        userId: context.pairwiseId,
      }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "service-name",
    middlewares: [extractUser, customMiddleware],
  },
);
```

---

## Related

**FLEX:**

- [@flex/logging](/libs/logging/README.md)
- [@flex/middlewares](/libs/middlewares/README.md)

**External:**

- [Middy Middlewares](https://middy.js.org/docs/middlewares/)
- [AWS Lambda Powertools Logger](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/)
