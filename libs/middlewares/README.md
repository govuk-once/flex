# @flex/middlewares

Shared Middy middleware for FLEX Lambda handlers.

---

## Commands

Run these from the repository root:

| Command                                | Description    |
| -------------------------------------- | -------------- |
| `pnpm --filter @flex/middlewares lint` | Lint files     |
| `pnpm --filter @flex/middlewares test` | Run tests      |
| `pnpm --filter @flex/middlewares tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `libs/middlewares/`.

## API

| Name                                                  | Description                                         | Code                                |
| ----------------------------------------------------- | --------------------------------------------------- | ----------------------------------- |
| [`createSecretsMiddleware`](#createsecretsmiddleware) | Factory for type-safe Secrets Manager middleware    | [View](./src/secrets/index.ts)      |
| [`extractUser`](#extractuser)                         | Extracts pairwise ID from Lambda authorizer context | [View](./src/extract-user/index.ts) |

### Types

| Name                    | Description                                       | Code                                |
| ----------------------- | ------------------------------------------------- | ----------------------------------- |
| `ContextWithPairwiseId` | Extended context type with pairwise ID            | [View](./src/extract-user/index.ts) |
| `V2Authorizer`          | Type for API Gateway V2 Lambda authorizer context | [View](./src/extract-user/index.ts) |

---

## `createSecretsMiddleware`

Fetches secrets from AWS Secrets Manager and makes them available in the handler context.

Throws if any secret ID is `undefined`.

### Usage

```typescript
import { createLambdaHandler } from "@flex/handlers";
import { createSecretsMiddleware } from "@flex/middlewares";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

const secrets = {
  apiKey: process.env.MY_API_KEY_SECRET_ID, // pragma: allowlist secret
  databasePassword: process.env.MY_DB_PASSWORD_SECRET_ID, // pragma: allowlist secret
};

type SecretsContext = typeof secrets;

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  SecretsContext
>(
  async (event, context) => {
    // Type-safe access to secrets via context
    const { apiKey, databasePassword } = context;

    // business logic using secrets

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Success" }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "service-name",
    middlewares: [createSecretsMiddleware({ secrets })],
  },
);
```

#### With Options

Pass additional configuration to the underlying [`@middy/secrets-manager`](https://middy.js.org/docs/middlewares/secrets-manager/):

```typescript
createSecretsMiddleware({
  secrets: {
    // Add secrets
  },
  options: {
    awsClientOptions: {
      region: "eu-west-2",
    },
    cacheExpiry: 60_000,
    cacheKey: "custom-cache-key",
  },
});
```

---

## `extractUser`

Extracts the pairwise ID from the Lambda authorizer context and makes it available on the handler context.

Throws if the pairwise ID is not found in the authorizer context.

### Usage

```typescript
import { createLambdaHandler } from "@flex/handlers";
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
    return {
      statusCode: 200,
      body: JSON.stringify({ userId: context.pairwiseId }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "service-name",
    middlewares: [extractUser],
  },
);
```

---

## Related

**FLEX:**

- [@flex/handlers - With FLEX Middleware](/libs/handlers/README.md#with-flex-middleware)
- [Platform Development Guide](/docs/platform-development.md)

**External:**

- [Middy Middlewares](https://middy.js.org/docs/category/writing-middlewares/)
- [Middy Secrets Manager Middleware](https://middy.js.org/docs/middlewares/secrets-manager/)
