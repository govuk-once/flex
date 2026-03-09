import type { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import type { UdpRemoteClient } from "../client";
import { normalizeInboundPath } from "../utils/normalizeInboundPath";
import { ROUTE_CONTRACTS } from "./route";
import { RouteContract } from "./types";

export function matchToRouteContract(
  method: string,
  path: string,
): RouteContract | undefined {
  const lookUpKey = `${method.toUpperCase()}:${path}`;

  if (lookUpKey in ROUTE_CONTRACTS) {
    return ROUTE_CONTRACTS[lookUpKey as keyof typeof ROUTE_CONTRACTS];
  }

  // Add future dynamic routes here (e.g., GET /v1/identity/[serviceName])
  const DYNAMIC_ROUTES = [
    {
      pattern: /^POST:\/v1\/identity\/[^/]+\/[^/]+$/,
      contract: ROUTE_CONTRACTS["POST:/v1/identity"],
    },
  ];

  return DYNAMIC_ROUTES.find((route) => route.pattern.test(lookUpKey))?.contract;
};

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
