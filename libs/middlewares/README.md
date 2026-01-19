# @flex/middlewares

This package provides common middlewares, for use across the FLEX project, built on top of [middy.js](https://middy.js.org).

## Features

- **Extract User Middleware**: Extracts the pairwise ID from the Lambda authorizer context and makes it available in the handler context

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

## Testing & Linting

```bash
npx nx test middlewares
npx nx lint middlewares
```
