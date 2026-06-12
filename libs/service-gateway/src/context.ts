import type { Logger } from "@flex/logging";
import type { APIGatewayProxyEvent } from "aws-lambda";

import {
  resolveHeaders,
  resolveQueryParams,
  resolveRequestBody,
} from "../utils/resolvers";
import type { GatewayClient, GatewayStore } from "./types";
import type { MatchedRoute } from "./utils/routes";

interface ContextOptions {
  readonly client: GatewayClient;
  readonly logger: Logger;
  readonly route: MatchedRoute;
}

export function buildHandlerContext(
  event: APIGatewayProxyEvent,
  { client, logger, route }: ContextOptions,
): GatewayStore {
  const pathParams =
    Object.keys(route.params).length > 0 ? route.params : undefined;
  const queryParams = resolveQueryParams(
    event.queryStringParameters,
    route.config.query,
  );
  const body = resolveRequestBody(event.body, route.config.body);
  const headers = route.config.headers
    ? resolveHeaders(route.config.headers, event.headers)
    : undefined;

  return {
    client,
    logger,
    ...(pathParams && { pathParams }),
    ...(queryParams && { queryParams }),
    ...(headers && { headers }),
    ...(body !== undefined && { body }),
  };
}
