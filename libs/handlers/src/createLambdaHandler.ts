import { getLogger, injectLambdaContext, LoggerOptions } from "@flex/logging";
import middy, { MiddlewareObj, MiddyfiedHandler } from "@middy/core";
import type { Context, Handler } from "aws-lambda";

/**
 * Configuration options for creating a Lambda handler with middy
 */
export type LambdaHandlerConfig<TEvent = unknown, TResult = unknown> = {
  /**
   * Array of middy middlewares to apply to the handler
   */
  middlewares?: Array<MiddlewareObj<TEvent, TResult>>;
} & LoggerOptions;

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
 *     loggerOptions: { level: 'INFO', serviceName: 'my-service' },
 *   }
 * );
 * ```
 */
export function createLambdaHandler<
  TEvent = unknown,
  TResult = unknown,
  TContext = unknown,
>(
  handler: Handler<TEvent, TResult>,
  config: LambdaHandlerConfig<TEvent, TResult>,
): MiddyfiedHandler<TEvent, TResult, Error, TContext> {
  const middyHandler = middy<TEvent, TResult, Error, TContext>(handler);
  const logLevel = config.logLevel?.toUpperCase();

  middyHandler.use(
    injectLambdaContext(getLogger(config), {
      logEvent: logLevel === "DEBUG" || logLevel === "TRACE",
      correlationIdPath: "requestContext.requestId",
    }),
  );

  config.middlewares?.forEach((middleware) => {
    middyHandler.use(middleware);
  });

  return middyHandler;
}
