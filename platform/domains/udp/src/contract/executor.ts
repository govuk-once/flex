import type { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import type { UdpRemoteClient } from "../client";
import { normalizeInboundPath } from "../utils/normalizeInboundPath";
import { DYNAMIC_ROUTES, ROUTE_CONTRACTS } from "./route";
import { RouteContract } from "./types";

const DYNAMIC_ROUTE_LIST: { pattern: RegExp; contract: RouteContract }[] = [
  {
    pattern: /^POST:\/v1\/identity\/[^/]+\/[^/]+$/,
    contract: DYNAMIC_ROUTES["POST:/v1/identity/:serviceName/:identifier"],
  },
];

export function matchToRouteContract(
  method: string,
  path: string,
): RouteContract | undefined {
  const lookUpKey = `${method.toUpperCase()}:${path}`;

  if (lookUpKey in ROUTE_CONTRACTS) {
    return ROUTE_CONTRACTS[lookUpKey as keyof typeof ROUTE_CONTRACTS];
  }

  const match = DYNAMIC_ROUTE_LIST.find((route) =>
    route.pattern.test(lookUpKey),
  );

  return match?.contract;
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
