import { getLogger, injectLambdaContext, LoggerOptions } from "@flex/logging";
import middy, { MiddlewareObj, MiddyfiedHandler } from "@middy/core";
import type { Context } from "aws-lambda";

/**
 * Custom handler type that allows custom context types extending Context
 *
 * @template TEvent - The type of the Lambda event
 * @template TResult - The type of the Lambda response
 * @template TContext - The type of the Lambda context
 * @example
 * ```typescript
 * const handler = createLambdaHandler<
 *   APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
 *   APIGatewayProxyResultV2<HandlerResponse>,
 *   ContextWithPairwiseId & NotificationSecretContext
 * >(
 *   async (event: APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>, context: ContextWithPairwiseId & NotificationSecretContext) => {
 *     return { statusCode: 200, body: JSON.stringify({ message: "Hello, World!" }) };
 *   }
 * );
 * ```
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
  /**
   * Array of middy middlewares to apply to the handler
   */
  middlewares?: Array<MiddlewareObj<TEvent, TResult, Error, TContext>>;
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
  TContext extends Context = Context,
>(
  handler: CustomHandler<TEvent, TResult, TContext>,
  config: LambdaHandlerConfig<TEvent, TResult, TContext>,
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
