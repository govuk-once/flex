import {
  resolveHeaders,
  resolvePathParams,
  resolveQueryParams,
  resolveRequestBody,
} from "@flex/utils";
import type { APIGatewayProxyEvent } from "aws-lambda";

import type { GatewayContext } from "../types";
import type { MatchedRoute } from "./routes";

export type ParsedRequest = Pick<
  GatewayContext,
  "pathParams" | "queryParams" | "headers" | "body"
>;

export function parseRequest(
  event: APIGatewayProxyEvent,
  route: MatchedRoute,
): ParsedRequest {
  const pathParams = resolvePathParams(route.params);
  const queryParams = resolveQueryParams(
    event.queryStringParameters,
    route.config.query,
  );
  const headers = resolveHeaders(event.headers, route.config.headers);
  const body = resolveRequestBody(event.body, route.config.body);

  return {
    ...(pathParams && { pathParams }),
    ...(queryParams && { queryParams }),
    ...(headers && { headers }),
    ...(body !== undefined && { body }),
  };
}
