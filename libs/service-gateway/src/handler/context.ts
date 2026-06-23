import type { Logger } from "@flex/logging";
import {
  resolveHeaders,
  resolvePathParams,
  resolveQueryParams,
  resolveRequestBody,
} from "@flex/utils";
import type { APIGatewayProxyEvent } from "aws-lambda";

import type { GatewayClient, GatewayContext } from "../types";
import type { MatchedRoute } from "../utils/routes";

interface ContextOptions {
  readonly client: GatewayClient;
  readonly logger: Logger;
  readonly route: MatchedRoute;
}

export function buildContext(
  event: APIGatewayProxyEvent,
  { client, logger, route }: ContextOptions,
): GatewayContext {
  const pathParams = resolvePathParams(route.params);
  const queryParams = resolveQueryParams(
    event.queryStringParameters,
    route.config.query,
  );
  const headers = resolveHeaders(event.headers, route.config.headers);
  const body = resolveRequestBody(event.body, route.config.body);

  return {
    client,
    logger,
    ...(pathParams && { pathParams }),
    ...(queryParams && { queryParams }),
    ...(headers && { headers }),
    ...(body !== undefined && { body }),
  };
}
