import type { Logger } from "@flex/logging";
import { injectLambdaContext } from "@flex/logging";
import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";

export interface MiddlewareOptions {
  logger: Logger;
}

export function buildMiddleware({ logger }: MiddlewareOptions) {
  const loggingMiddleware = injectLambdaContext(logger, {
    clearState: true,
    correlationIdPath: "requestContext.requestId",
  });

  return middy<APIGatewayProxyEvent, APIGatewayProxyResultV2>().use(
    loggingMiddleware,
  );
}
