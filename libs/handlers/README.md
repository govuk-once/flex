# @libs/handlers

> A library for constructing Lambda handlers with middy middleware support

This library provides a factory function to simplify the creation of AWS Lambda handlers using the [middy](https://middy.js.org/) middleware framework. It streamlines the process of developing Lambda functions by providing a consistent, type-safe way to wrap handlers with middleware.

## Usage

### Basic Handler

Create a simple Lambda handler without middleware:

```typescript
import { createLambdaHandler } from '@flex/handlers';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const handler = createLambdaHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Hello, World!' }),
    };
  },
);

export { handler };
```

### Handler with Custom Middleware

You can also create and use custom middleware:

```typescript
import { createLambdaHandler } from '@libs/handlers';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { MiddlewareObj } from '@middy/core';

// Custom logging middleware
const loggingMiddleware: MiddlewareObj<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> = {
  before: async (request) => {
    console.log('Request received:', {
      path: request.event.path,
      method: request.event.httpMethod,
    });
  },
  after: async (request) => {
    console.log('Response sent:', {
      statusCode: request.response.statusCode,
    });
  },
};

const handler = createLambdaHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' }),
    };
  },
  {
    middlewares: [loggingMiddleware],
  },
);

export { handler };
```

#### Parameters

- `handler` (required): The core Lambda handler function that processes events
- `config` (optional): Configuration object with the following properties:
  - `middlewares`: Array of middy middleware objects to apply to the handler

#### Returns

A `MiddyfiedHandler` that can be used as an AWS Lambda handler.

## Available Commands

```bash
# Run tests
npx nx test handlers

# Run linter
npx nx lint handlers
```

<!-- ## Examples -->

<!-- TODO: See the `domains/udp/src/handlers` directory for real-world examples of using this library. -->

## Middleware Resources

For more information about available middy middlewares, visit:

- [Middy Documentation](https://middy.js.org/)
- [Middy Middlewares](https://middy.js.org/docs/middlewares/)
