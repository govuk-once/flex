import { injectLambdaContext, logger, LogLevel } from "@flex/logging";
import middy, { MiddlewareObj, MiddyfiedHandler } from "@middy/core";
import httpErrorHandler from "@middy/http-error-handler";
import type { Context } from "aws-lambda";

import { clearTmp } from "./cleanup";

/**
 * Custom handler type that allows custom context types extending Context
 *
 * @template TEvent - The type of the Lambda event
 * @template TResult - The type of the Lambda response
 * @template TContext - The type of the Lambda context
 */
type CustomHandler<TEvent, TResult, TContext extends Context = Context> = (
  event: TEvent,
  context: TContext,
) => Promise<TResult>;

/**
 * Configuration options for creating a Lambda handler with middy
 */
export type LambdaHandlerConfig<
  TEvent = unknown,
  TResult = unknown,
  TContext = unknown,
> = {
  serviceName: string;
  logLevel?: string;
  /**
   * Array of middy middlewares to apply to the handler
   */
  middlewares?: Array<MiddlewareObj<TEvent, TResult, Error, TContext>>;
};

/**
 * Creates a generic Lambda handler wrapped with middy middleware framework
 *
 * @template TEvent - The type of the Lambda event
 * @template TResult - The type of the Lambda response
 * @param handler - The core Lambda handler function
 * @param config - Configuration for the handler
 * @returns A middy-wrapped Lambda handler
 *
 * @example
 * ```typescript
 * export const handler = createLambdaHandler<
 *   APIGatewayProxyWithLambdaAuthorizerEvent<V2Authorizer>,
 *   APIGatewayProxyResultV2,
 *   ContextWithUserId & NotificationSecretContext
 * >(
 *   async (event, context) => {
 *     const { userId } = context;
 *     return jsonResponse(200, { userId });
 *   },
 *   {
 *     serviceName: "my-service",
 *     middlewares: [extractUser, httpJsonBodyParser()],
 *   },
 * );
 * ```
 */
export function createLambdaHandler<
  TEvent = unknown,
  TResult = unknown,
  TContext extends Context = Context,
>(
  handler: CustomHandler<TEvent, TResult, TContext>,
  config: LambdaHandlerConfig<TEvent, TResult, TContext>,
): MiddyfiedHandler<TEvent, TResult, Error, TContext> {
  const logLevel = config.logLevel?.toUpperCase() ?? "INFO";
  const loggerInstance = logger(config.serviceName, logLevel as LogLevel);

  const middyHandler = middy<TEvent, TResult, Error, TContext>()
    .use(httpErrorHandler())
    .handler(handler);

  middyHandler.use(
    injectLambdaContext(loggerInstance, {
      clearState: true,
      logEvent: logLevel === "DEBUG" || logLevel === "TRACE",
      correlationIdPath: "requestContext.requestId",
    }),
  );

  config.middlewares?.forEach((middleware) => {
    middyHandler.use(middleware);
  });

  clearTmp();

  return middyHandler;
}
