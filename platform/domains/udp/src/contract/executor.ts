import type { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import type { UdpRemoteClient } from "../client";
import { matchToRouteContract } from "./route";

export async function execute(
  event: APIGatewayProxyEvent,
  client: UdpRemoteClient,
): Promise<ApiResult<unknown>> {
  const mapping = matchToRouteContract(
    event.httpMethod,
    normalizeInboundPath(event.path),
  );

  if (!mapping) {
    throw new createHttpError.NotFound("Route not found");
  }
  return mapping.remoteExecutor(event, client);
}

function normalizeInboundPath(path: string): string {
  if (path.startsWith("/gateways/udp")) {
    const normalized = path.replace(/^\/gateways\/udp/, "");
    return normalized.length > 0 ? normalized : "/";
  }
  return path;
}
