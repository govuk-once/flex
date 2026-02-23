import { getLogger } from "@flex/logging";
import { getHeader } from "@flex/utils";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import type { PreferencesRequest } from "../schemas/remote/preferences";
import type { CreateUserRequest } from "../schemas/remote/user";
import { matchToRouteContract } from "./route";
import type { ResolvedRequest, RouteContract } from "./types";

/**
 * Resolves the request to a known operation and validates the headers and body.
 */
export async function resolveRequest(
  event: APIGatewayProxyEvent,
): Promise<ResolvedRequest> {
  const logger = getLogger();
  const mapping = matchToRouteContract(
    event.httpMethod,
    normalizeInboundPath(event.path),
  );
  if (!mapping) {
    logger.warn("Route not registered in route config", {
      path: event.path,
      method: event.httpMethod,
    });
    throw new createHttpError.NotFound("Route not found");
  }

  switch (mapping.operation) {
    case "getNotifications":
      return {
        operation: "getNotifications",
        requestingServiceUserId: assertRequiredHeaderAndReturn(
          event,
          "requesting-service-user-id",
        ),
      };
    case "updateNotifications":
      return {
        operation: "updateNotifications",
        requestingServiceUserId: assertRequiredHeaderAndReturn(
          event,
          "requesting-service-user-id",
        ),
        remoteBody: await parseAndMapBody<PreferencesRequest>(mapping, event),
      };
    case "createUser":
      return {
        operation: "createUser",
        remoteBody: await parseAndMapBody<CreateUserRequest>(mapping, event),
      };
    default:
      throw new createHttpError.BadRequest("Unknown operation");
  }
}

async function parseAndMapBody<T>(
  mapping: RouteContract,
  event: APIGatewayProxyEvent,
): Promise<T> {
  const body = parseRequestBody(event.body);
  if (!mapping.inboundSchema) {
    throw new createHttpError.InternalServerError(
      "No inbound schema found for this operation.",
    );
  }
  const data = await mapping.inboundSchema.safeParseAsync(body);
  if (!data.success) {
    throw new createHttpError.BadRequest("Invalid request body");
  }
  return mapping.toRemoteBody(data.data as never) as T;
}

function assertRequiredHeaderAndReturn(
  event: APIGatewayProxyEvent,
  header: string,
): string {
  const value = getHeader(event, header);
  if (!value) {
    throw new createHttpError.BadRequest(`Missing ${header} header`);
  }
  return value;
}

function parseRequestBody(body: string | null): unknown {
  if (!body) {
    throw new createHttpError.BadRequest("Missing request body");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new createHttpError.BadRequest("Invalid JSON body");
  }
}

function normalizeInboundPath(path: string): string {
  if (path.startsWith("/gateways/udp")) {
    const normalized = path.replace(/^\/gateways\/udp/, "");
    return normalized.length > 0 ? normalized : "/";
  }
  return path;
}
