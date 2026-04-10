import type { FullLogger, Logger } from "@flex/logging";
import { injectLambdaContext } from "@flex/logging";
import middy from "@middy/core";
import httpErrorHandler from "@middy/http-error-handler";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import secretsManagerMiddleware, { secret } from "@middy/secrets-manager";
import ssmMiddleware from "@middy/ssm";
import { APIGatewayProxyResult } from "aws-lambda";

import type { LambdaEvent, LambdaResult } from "../types";
import type { ResolvedResource } from "./resolve-config";

export interface MiddlewareOptions {
  readonly logger: Logger;
  readonly logLevel: string;
  readonly hasRequestBody: boolean;
  readonly resources?: Readonly<Record<string, ResolvedResource>>;
}

export function configureMiddleware({
  logger,
  logLevel,
  hasRequestBody,
  resources,
}: MiddlewareOptions): middy.MiddyfiedHandler<
  LambdaEvent,
  APIGatewayProxyResult
> {
  const middyHandler = middy<LambdaEvent, LambdaResult>()
    .use(
      httpErrorHandler({
        logger: (error: Error) => {
          logger.error("Unhandled error", { detail: error });
        },
      }),
    )
    .use(
      injectLambdaContext(logger as FullLogger, {
        logEvent: logLevel === "DEBUG" || logLevel === "TRACE",
        correlationIdPath: "requestContext.requestId",
      }),
    );

  if (hasRequestBody) {
    middyHandler
      .use(httpHeaderNormalizer())
      .use(httpJsonBodyParser<LambdaEvent>());
  }

  if (resources && Object.keys(resources).length > 0) {
    const entries = Object.entries(resources);
    const secrets = entries.filter(([_, { type }]) => type === "secret");

    if (secrets.length > 0) {
      middyHandler.use(
        secretsManagerMiddleware({
          fetchData: Object.fromEntries(
            secrets.map(([key, { value }]) => [key, secret(value)]),
          ),
          setToContext: true,
        }),
      );
    }

    const params = entries.filter(([_, { type }]) => type === "ssm:runtime");

    if (params.length > 0) {
      middyHandler.use(
        ssmMiddleware({
          fetchData: Object.fromEntries(
            params.map(([key, { value }]) => [key, value]),
          ),
          setToContext: true,
        }),
      );
    }
  }

  return middyHandler;
}
