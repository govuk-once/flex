# @flex/middlewares

This package provides common middlewares, for use across the FLEX project, built on top of [middy.js](https://middy.js.org).

## Features

- **Extract User Middleware**: Extracts the pairwise ID from the Lambda authorizer context and makes it available in the handler context
- **Secrets Middleware**: Fetches secrets from AWS Secrets Manager and makes them available in the handler context

## Usage

### Basic Example

```typescript
import { createLambdaHandler } from "@flex/handlers";
import {
  type ContextWithPairwiseId,
  extractUser,
  type V2Authorizer,
} from "@flex/middlewares";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2,
  ContextWithPairwiseId
>(
  async (_event: APIGatewayProxyEventV2, context: ContextWithPairwiseId) => {
    // Access the pairwise ID from the context
    const pairwiseId = context.pairwiseId;

    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify({ userId: pairwiseId }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "my-service",
    middlewares: [extractUser],
  },
);
```

### Using Secrets Middleware

```typescript
import { createLambdaHandler } from "@flex/handlers";
import {
  type ContextWithPairwiseId,
  createSecretsMiddleware,
  extractUser,
  type V2Authorizer,
} from "@flex/middlewares";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";

// Define your custom context type that includes the secrets
type MyHandlerContext = ContextWithPairwiseId & {
  apiKey: string;
  databasePassword: string;
};

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2,
  MyHandlerContext
>(
  async (_event: APIGatewayProxyEventV2, context: MyHandlerContext) => {
    // Access secrets from the context
    const { pairwiseId, apiKey, databasePassword } = context;

    // Use the secrets in your handler logic
    // ...

    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify({ userId: pairwiseId }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "my-service",
    middlewares: [
      extractUser,
      createSecretsMiddleware<MyHandlerContext>({
        secrets: {
          // Map context property names to Secrets Manager secret IDs
          // The secret IDs come from environment variables
          apiKey: process.env.MY_API_KEY_SECRET_ID,
          databasePassword: process.env.MY_DB_PASSWORD_SECRET_ID,
        },
      }),
    ],
  },
);
```

### API

#### `extractUser`

A middy middleware that extracts the pairwise ID from the Lambda authorizer context.

**Type**: `MiddlewareObj<APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>, unknown, Error, ContextWithPairwiseId>`

**Behavior**:

- Extracts `pairwiseId` from `event.requestContext.authorizer.lambda.pairwiseId`
- Sets it on `context.pairwiseId` for use in the handler
- Throws an error if the pairwise ID is not found

**Usage**:

- Add to the `middlewares` array when creating a Lambda handler with `createLambdaHandler`
- Ensure your handler uses `APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>` as the event type
- Ensure your handler context type is `ContextWithPairwiseId`

#### `ContextWithPairwiseId`

Extended AWS Lambda Context type that includes the `pairwiseId` property.

```typescript
interface ContextWithPairwiseId extends Context {
  pairwiseId?: string;
}
```

#### `V2Authorizer`

Type definition for the Lambda authorizer context in API Gateway V2.

```typescript
interface V2Authorizer {
  pairwiseId?: string;
}
```

#### `createSecretsMiddleware`

A factory function that creates a middy middleware for fetching secrets from AWS Secrets Manager and making them available in the handler context.

**Type**: `<TSecrets extends Record<string, string | undefined>>(opts: { secrets: { [K in keyof TSecrets & string]: string | undefined } }) => MiddlewareObj<unknown, unknown, Error, Context & TSecrets>`

**Parameters**:

- `opts.secrets`: An object mapping context property names to Secrets Manager secret IDs (typically from environment variables)

**Behavior**:

- Fetches secrets from AWS Secrets Manager using the provided secret IDs
- Sets the secret values on the Lambda context using the property names from the `secrets` mapping
- Throws an error if any secret ID is `undefined` (fail-fast on misconfiguration)
- Secrets are cached for the duration of the Lambda execution

**Usage**:

1. Define a custom context type that extends `Context` (or `ContextWithPairwiseId`) with your secret properties:
   ```typescript
   type MyHandlerContext = ContextWithPairwiseId & {
     mySecretKey: string;
   };
   ```
2. Add `createSecretsMiddleware` to the `middlewares` array when creating a Lambda handler
3. Map context property names to Secrets Manager secret IDs (from environment variables):
   ```typescript
   createSecretsMiddleware<MyHandlerContext>({
     secrets: {
       mySecretKey: process.env.MY_SECRET_ID,
     },
   });
   ```
4. Ensure your handler context type includes the secret properties:
   ```typescript
   createLambdaHandler<Event, Result, MyHandlerContext>(...)
   ```
5. Access secrets from the context in your handler:
   ```typescript
   const { mySecretKey } = context;
   ```

**Important Notes**:

- Secret IDs in environment variables should be the full Secrets Manager secret name/ARN (not the secret value itself)
- The Lambda function must have IAM permissions to read from Secrets Manager
- For Lambda functions in VPCs, ensure a VPC endpoint for Secrets Manager is configured
- Secrets are automatically cached by `@middy/secrets-manager` to avoid repeated API calls

## Testing & Linting

```bash
npx nx test middlewares
npx nx lint middlewares
```
