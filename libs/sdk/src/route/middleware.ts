import type { Logger } from "@flex/logging";
import { injectLambdaContext } from "@flex/logging";
import middy from "@middy/core";
import httpErrorHandler from "@middy/http-error-handler";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import secretsManagerMiddleware, { secret } from "@middy/secrets-manager";
import ssmMiddleware from "@middy/ssm";

import type { LambdaEvent, LambdaResult } from "../types";
import type { ResolvedResource } from "./context";

interface MiddlewareOptions {
  readonly logger: Logger;
  readonly logLevel: string;
  readonly hasRequestBody: boolean;
  readonly resources?: ReadonlyMap<string, ResolvedResource>;
}

export function configureMiddleware({
  logger,
  logLevel,
  hasRequestBody,
  resources,
}: MiddlewareOptions) {
  const middyHandler = middy<LambdaEvent, LambdaResult>()
    .use(
      httpErrorHandler({
        logger: (error: Error) => {
          logger.error("Unhandled error", { error });
        },
      }),
    )
    .use(
      injectLambdaContext(logger, {
        logEvent: logLevel === "DEBUG" || logLevel === "TRACE",
        correlationIdPath: "requestContext.requestId",
      }),
    );

  if (hasRequestBody) {
    middyHandler
      .use(httpHeaderNormalizer())
      .use(httpJsonBodyParser<LambdaEvent>());
  }

  if (resources && resources.size > 0) {
    const secrets = Array.from(resources).filter(
      ([_, { type }]) => type === "secret",
    );

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

    const params = Array.from(resources).filter(
      ([_, { type }]) => type === "ssm:deferred",
    );

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
