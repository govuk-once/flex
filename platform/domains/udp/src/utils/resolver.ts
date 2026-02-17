import type { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { getLogger } from "@flex/logging";
import { matchRemoteRoute } from "../routes";
import { getHeader } from "./getHeader";
import { jsonResponse } from "@flex/utils";
import status from "http-status";

import type { RemoteRouteMapping } from "../routes";

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
    | { ok: false; response: APIGatewayProxyResultV2 };

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
