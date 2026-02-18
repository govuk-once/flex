import { getLogger } from "@flex/logging";
import { jsonResponse } from "@flex/utils";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import status from "http-status";

import type { RemoteRouteMapping } from "../routes";
import { matchRemoteRoute } from "../routes";
import { getHeader } from "./getHeader";

function parseRequestBody(body: string | null): unknown {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

type ResolvedRequest = {
  mapping: RemoteRouteMapping;
  body: unknown;
  requestingServiceUserId: string;
};

type ResolveResult =
  | { ok: true; request: ResolvedRequest }
  | { ok: false; response: APIGatewayProxyResult };

/**
 * Validates input (including headers) and matches the route in a single step.
 * Returns resolved request or an error response.
 */
export function resolveRequest(
  event: APIGatewayProxyEvent,
  stageName: string,
  logger: ReturnType<typeof getLogger>,
): ResolveResult {
  const mapping = matchRemoteRoute(
    event.httpMethod,
    event.pathParameters?.proxy,
    stageName,
  );
  if (!mapping) {
    logger.warn("Route not registered in route config", { event });
    return {
      ok: false,
      response: jsonResponse(status.NOT_FOUND, { message: "Route not found" }),
    };
  }

  const requestingServiceUserId =
    getHeader(event, "requesting-service-user-id")?.trim() ?? "";

  if (mapping.requiresHeaders && !requestingServiceUserId) {
    logger.warn("Missing required requesting-service-user-id header", {
      mapping,
    });
    return {
      ok: false,
      response: jsonResponse(status.BAD_REQUEST, {
        message: "requesting-service-user-id header is required for this route",
      }),
    };
  }

  const body = parseRequestBody(event.body);
  return {
    ok: true,
    request: { mapping, body, requestingServiceUserId },
  };
}
