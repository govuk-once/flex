# @libs/handlers

> A library for constructing Lambda handlers with middy middleware support

This library provides a factory function to simplify the creation of AWS Lambda handlers using the [middy](https://middy.js.org/) middleware framework. It streamlines the process of developing Lambda functions by providing a consistent, type-safe way to wrap handlers with middleware.

## Automatic Logging Middleware

All handlers created with `createLambdaHandler` automatically include logging middleware powered by [AWS Lambda Powertools Logger](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/). This means:

- A singleton logger instance is created and injected into the Lambda context for every invocation.
- The logger is available for use in your handler and any custom middleware.
- The logger instance is cached for the lifetime of the Lambda runtime, ensuring consistent logging and performance.

### Accessing the Logger

You can access the logger instance in your handler or middleware by importing it from the logging package:

```typescript
import { getLogger } from '@flex/logging';

const logger = getLogger();
logger.info('This will be logged with context!');
```

The logger is automatically configured and context-aware for each Lambda invocation.

## Usage

### Basic Handler

Create a simple Lambda handler (logging is available automatically):

```typescript
import { createLambdaHandler } from '@flex/handlers';
import { getLogger } from '@flex/logging';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const handler = createLambdaHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const logger = getLogger();
    logger.info('Handling request', { path: event.path });
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
