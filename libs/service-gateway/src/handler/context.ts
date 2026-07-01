import type { Logger } from "@flex/logging";
import type { ReadonlyRecord } from "@flex/utils";
import {
  resolveHeaders,
  resolvePathParams,
  resolveQueryParams,
  resolveRequestBody,
} from "@flex/utils";
import type { APIGatewayProxyEvent } from "aws-lambda";

import type { GatewayClientMap, GatewayContext } from "../types";
import type { MatchedRoute } from "../utils/routes";

interface ContextOptions {
  readonly clients: GatewayClientMap;
  readonly resources: ReadonlyRecord<string, unknown>;
  readonly logger: Logger;
  readonly route: MatchedRoute;
}

export function buildContext(
  event: APIGatewayProxyEvent,
  { clients, resources, logger, route }: ContextOptions,
): GatewayContext {
  const pathParams = resolvePathParams(route.params);
  const queryParams = resolveQueryParams(
    event.queryStringParameters,
    route.config.query,
  );
  const headers = resolveHeaders(event.headers, route.config.headers);
  const body = resolveRequestBody(event.body, route.config.body);

  return {
    clients,
    resources,
    logger,
    ...(pathParams && { pathParams }),
    ...(queryParams && { queryParams }),
    ...(headers && { headers }),
    ...(body !== undefined && { body }),
  };
}
