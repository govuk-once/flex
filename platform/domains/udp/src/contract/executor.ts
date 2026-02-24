import type { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import type { UdpRemoteClient } from "../client";
import { matchToRouteContract } from "./route";
import type { MutationRouteContract } from "./types";

/**
 * Executes a contract based on the event and client.
 *
 * @param event - The event from the API gateway.
 * @param client - The client to use to execute the contract.
 * @returns The result of the contract execution.
 */
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

  if (mapping.method === "GET") {
    const context = mapping.buildContext(event);
    return mapping.callRemote(client, context);
  }

  return executeMutation(mapping, event, client);
}

async function executeMutation(
  mapping: MutationRouteContract,
  event: APIGatewayProxyEvent,
  client: UdpRemoteClient,
): Promise<ApiResult<unknown>> {
  const context = mapping.buildContext(event);
  const remoteBody = await parseAndMapBody(mapping, event);
  const callRemote = mapping.callRemote as (
    udpClient: UdpRemoteClient,
    input: Record<string, unknown>,
  ) => Promise<ApiResult<unknown>>;
  return callRemote(client, {
    ...(context as Record<string, unknown>),
    remoteBody,
  });
}

async function parseAndMapBody(
  mapping: MutationRouteContract,
  event: APIGatewayProxyEvent,
): Promise<unknown> {
  const body = parseRequestBody(event.body);
  const data = await mapping.inboundSchema.safeParseAsync(body);
  if (!data.success)
    throw new createHttpError.BadRequest("Invalid request body");
  return mapping.toRemoteBody(data.data as never);
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
