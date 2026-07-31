import { logger } from "@flex/logging";
import { ApiResult } from "@flex/sdk";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import type { UnsRemoteClient } from "../client";
import { normalizeInboundPath } from "../utils/normalizeInboundPath";
import { ROUTE_CONTRACTS } from "./route";
import { RouteContract } from "./types";

const DYNAMIC_ROUTE_LIST: { pattern: RegExp; contract: RouteContract }[] = [
  {
    pattern: /^GET:\/v1\/notifications\/[^/]+$/,
    contract: ROUTE_CONTRACTS["GET:/v1/notifications/:id"],
  },
  {
    pattern: /^DELETE:\/v1\/notifications\/[^/]+$/,
    contract: ROUTE_CONTRACTS["DELETE:/v1/notifications/:id"],
  },
  {
    pattern: /^PATCH:\/v1\/notifications\/[^/]+\/status$/,
    contract: ROUTE_CONTRACTS["PATCH:/v1/notifications/:id/status"],
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
  client: UnsRemoteClient,
) {
  const data = await contract.toRemote(event);

  logger.info("Calling remote UNS operation", {
    operation: contract.operation,
    method: contract.method,
    remotePath: contract.remotePath,
  });

  const result = await contract.callRemote(client, data as never);

  if (!result.ok) {
    logger.error("Remote UNS operation failed", {
      operation: contract.operation,
      status: result.error.status,
      message: result.error.message,
    });
    return result;
  }

  logger.info("Remote UNS operation succeeded", {
    operation: contract.operation,
    status: result.status,
  });

  return {
    ok: result.ok,
    status: result.status,
    data: contract.toDomain ? contract.toDomain(result.data) : result.data,
  };
}

export async function execute(
  event: APIGatewayProxyEvent,
  client: UnsRemoteClient,
): Promise<ApiResult<unknown>> {
  const mapping = matchToRouteContract(
    event.httpMethod,
    normalizeInboundPath(event.path),
  );

  if (!mapping) {
    throw new createHttpError.NotFound("Route not found");
  }

  logger.info("UNS gateway route matched", {
    operation: mapping.operation,
    method: mapping.method,
    inboundPath: mapping.inboundPath,
    remotePath: mapping.remotePath,
  });

  return run(mapping, event, client);
}
