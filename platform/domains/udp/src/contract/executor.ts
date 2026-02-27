import type { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import type { UdpRemoteClient } from "../client";
import { ROUTE_CONTRACTS } from "./route";
import { RouteContract } from "./types";

export function matchToRouteContract(
  method: string,
  path: string,
): RouteContract | undefined {
  const key = `${method.toUpperCase()}:${path}`;
  if (key in ROUTE_CONTRACTS) {
    return ROUTE_CONTRACTS[key as keyof typeof ROUTE_CONTRACTS];
  }
  return undefined;
}

async function run(
  contract: RouteContract,
  event: APIGatewayProxyEvent,
  client: UdpRemoteClient,
) {
  const data = await contract.toRemote(event);

  const result = await contract.callRemote(client, data as never);

  if (!result.ok) return result;

  return {
    ok: result.ok,
    status: result.status,
    data: contract.toDomain
      ? contract.toDomain(result.data as never)
      : result.data,
  };
}

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

  return run(mapping, event, client);
}

function normalizeInboundPath(path: string): string {
  if (path.startsWith("/gateways/udp")) {
    const normalized = path.replace(/^\/gateways\/udp/, "");
    return normalized.length > 0 ? normalized : "/";
  }
  return path;
}
