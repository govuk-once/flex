import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { createLambdaHandler } from './createLambdaHandler';
import type { MiddlewareObj } from '@middy/core';

const baseLoggerOptions = {
  logLevel: 'INFO' as const,
  serviceName: 'test-service',
};

describe('createLambdaHandler', () => {
  const mockContext = {
    getRemainingTimeInMillis: () => 1000,
  } as unknown as Context;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic handler creation', () => {
    it('creates a middy handler from a simple handler function', async () => {
      const handlerFn = async (): Promise<APIGatewayProxyResult> => {
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'success' }),
        };
      };

      const handler = createLambdaHandler(handlerFn, baseLoggerOptions);
      const event = {} as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ message: 'success' });
    });
  });

  describe('middleware support', () => {
    it('applies middleware to the handler', async () => {
      const beforeMiddleware = vi.fn();
      const afterMiddleware = vi.fn();

      const middleware: MiddlewareObj<
        APIGatewayProxyEvent,
        APIGatewayProxyResult
      > = {
        before: async (request) => {
          beforeMiddleware(request.event);
        },
        after: async (request) => {
          afterMiddleware(request.response);
        },
      };

      const handlerFn = async (): Promise<APIGatewayProxyResult> => {
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'success' }),
        };
      };

      const handler = createLambdaHandler(handlerFn, {
        middlewares: [middleware],
        ...baseLoggerOptions,
      });

      const event = { path: '/test' } as APIGatewayProxyEvent;
      await handler(event, mockContext);

      expect(beforeMiddleware).toHaveBeenCalledWith(event);
      expect(afterMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
        }),
      );
    });

    it('applies multiple middlewares in order', async () => {
      const callOrder: string[] = [];

      const middleware1: MiddlewareObj<
        APIGatewayProxyEvent,
        APIGatewayProxyResult
      > = {
        before: async () => {
          callOrder.push('middleware1-before');
        },
        after: async () => {
          callOrder.push('middleware1-after');
        },
      };

      const middleware2: MiddlewareObj<
        APIGatewayProxyEvent,
        APIGatewayProxyResult
      > = {
        before: async () => {
          callOrder.push('middleware2-before');
        },
        after: async () => {
          callOrder.push('middleware2-after');
        },
      };

      const handlerFn = async (): Promise<APIGatewayProxyResult> => {
        callOrder.push('handler');
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'success' }),
        };
      };

      const handler = createLambdaHandler(handlerFn, {
        middlewares: [middleware1, middleware2],
        ...baseLoggerOptions,
      });

      const event = {} as APIGatewayProxyEvent;
      await handler(event, mockContext);

      expect(callOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after',
      ]);
    });
  });

  describe('type safety', () => {
    it('maintains type safety for event and response types', async () => {
      const handlerFn = async (
        event: APIGatewayProxyEvent,
      ): Promise<APIGatewayProxyResult> => {
        const userId = event.pathParameters?.userId;
        return {
          statusCode: 200,
          body: JSON.stringify({ userId }),
        };
      };

      const handler = createLambdaHandler(handlerFn, {
        ...baseLoggerOptions,
      });
      const event = {
        pathParameters: { userId: 'user-123' },
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/test',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '1234567890',
          apiId: '1234567890',
          authorizer: null,
          path: '/test',
          httpMethod: 'GET',
          requestId: '1234567890',
        } as unknown as APIGatewayProxyEvent['requestContext'],
        resource: '/test',
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ userId: 'user-123' });
    });
  });

  describe('handler without middlewares', () => {
    it('creates a handler when no middlewares are provided', async () => {
      const handlerFn = async (): Promise<APIGatewayProxyResult> => {
        return {
          statusCode: 201,
          body: JSON.stringify({ created: true }),
        };
      };

      const handler = createLambdaHandler(handlerFn, {
        ...baseLoggerOptions,
      });
      const event = {} as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body)).toEqual({ created: true });
    });
  });
});
