import middy, { MiddyfiedHandler, MiddlewareObj } from '@middy/core';
import type { Handler, Context } from 'aws-lambda';

/**
 * Configuration options for creating a Lambda handler with middy
 */
export interface LambdaHandlerConfig<TEvent = unknown, TResult = unknown> {
  /**
   * Array of middy middlewares to apply to the handler
   */
  middlewares?: Array<MiddlewareObj<TEvent, TResult>>;
}

/**
 * Creates a generic Lambda handler wrapped with middy middleware framework
 *
 * @template TEvent - The type of the Lambda event
 * @template TResult - The type of the Lambda response
 * @param handler - The core Lambda handler function
 * @param config - Optional configuration for middlewares
 * @returns A middy-wrapped Lambda handler
 *
 * @example
 * ```typescript
 * const handler = createLambdaHandler(
 *   async (event: CustomEvent) => {
 *     return { result: 'success' };
 *   },
 *   {
 *     middlewares: [customMiddleware()],
 *   }
 * );
 * ```
 */
export function createLambdaHandler<TEvent = unknown, TResult = unknown>(
  handler: Handler<TEvent, TResult>,
  config?: LambdaHandlerConfig<TEvent, TResult>,
): MiddyfiedHandler<TEvent, TResult, Error, Context> {
  const middyHandler = middy<TEvent, TResult, Error, Context>(handler);

  // Apply custom middlewares
  if (config?.middlewares && config.middlewares.length > 0) {
    config.middlewares.forEach((middleware) => {
      middyHandler.use(middleware);
    });
  }

  return middyHandler;
}
