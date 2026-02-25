import type { ApiResult } from "@flex/flex-fetch";
import { getHeader } from "@flex/utils";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";
import z from "zod";

import type { UdpRemoteClient } from "../client";
import { inboundPreferencesRequestSchema } from "../schemas/inbound/preferences";
import { inboundCreateUserRequestSchema } from "../schemas/inbound/user";
import type { RouteContract } from "./types";

const INTERNAL_ROUTES = {
  user: "/v1/user",
  notifications: "/v1/notifications",
} as const;

export const UDP_REMOTE_BASE = "/udp/v1";

export const UDP_REMOTE_ROUTES = {
  notifications: "/notifications",
  user: "/user",
} as const;

export const ROUTE_CONTRACTS = {
  "POST:/v1/user": {
    operation: "createUser",
    method: "POST",
    inboundPath: INTERNAL_ROUTES.user,
    remotePath: UDP_REMOTE_ROUTES.user,
    remoteExecutor: makeExecuteRemote(
      async (event) => ({
        remoteBody: await parseAndMapBody(
          inboundCreateUserRequestSchema,
          (inbound) => inbound,
          event,
        ),
      }),
      (client, { remoteBody }) => client.createUser(remoteBody),
      (remote) => ({
        message: remote.message,
      }),
    ),
  },
  "POST:/v1/notifications": {
    operation: "updateNotifications",
    method: "POST",
    inboundPath: INTERNAL_ROUTES.notifications,
    remotePath: UDP_REMOTE_ROUTES.notifications,
    remoteExecutor: makeExecuteRemote(
      async (event) => ({
        requestingServiceUserId: assertRequiredHeaderAndReturn(
          event,
          "requesting-service-user-id",
        ),
        remoteBody: await parseAndMapBody(
          inboundPreferencesRequestSchema,
          (inbound) => ({
            notifications: {
              consentStatus: inbound.preferences.notifications.consentStatus,
            },
          }),
          event,
        ),
      }),
      (client, { remoteBody, requestingServiceUserId }) =>
        client.updatePreferences(remoteBody, requestingServiceUserId),
      (remote) => ({
        preferences: {
          notifications: {
            consentStatus: remote.preferences.notifications.consentStatus,
            updatedAt: remote.preferences.notifications.updatedAt,
          },
        },
      }),
    ),
  },
  "GET:/v1/notifications": {
    operation: "getNotifications",
    method: "GET",
    inboundPath: INTERNAL_ROUTES.notifications,
    remotePath: UDP_REMOTE_ROUTES.notifications,
    remoteExecutor: makeExecuteRemote(
      (event) =>
        Promise.resolve({
          requestingServiceUserId: assertRequiredHeaderAndReturn(
            event,
            "requesting-service-user-id",
          ),
        }),
      (client, { requestingServiceUserId }) =>
        client.getPreferences(requestingServiceUserId),
      (remote) => ({
        preferences: {
          notifications: {
            consentStatus: remote.preferences.notifications.consentStatus,
            updatedAt: remote.preferences.notifications.updatedAt,
          },
        },
      }),
    ),
  },
} as const satisfies Record<string, RouteContract>;

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

async function parseAndMapBody<TSchema extends z.ZodType, TRemoteBody>(
  schema: TSchema,
  toRemoteBody: (inbound: z.output<TSchema>) => TRemoteBody,
  event: APIGatewayProxyEvent,
): Promise<TRemoteBody> {
  const body = parseRequestBody(event.body);
  const data = await schema.safeParseAsync(body);
  if (!data.success) {
    throw new createHttpError.BadRequest("Invalid request body");
  }
  return toRemoteBody(data.data);
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

function makeExecuteRemote<TRemoteRequest, TRemoteResponse, TDomainResponse>(
  toRemote: (event: APIGatewayProxyEvent) => Promise<TRemoteRequest>,
  callRemote: (
    client: UdpRemoteClient,
    input: TRemoteRequest,
  ) => Promise<ApiResult<TRemoteResponse>>,
  fromRemote: (remote: TRemoteResponse) => TDomainResponse,
) {
  return async (
    event: APIGatewayProxyEvent,
    client: UdpRemoteClient,
  ): Promise<ApiResult<TDomainResponse>> => {
    const request = await toRemote(event);
    const result = await callRemote(client, request);
    if (!result.ok) {
      return result;
    }
    return {
      ok: true,
      status: result.status,
      data: fromRemote(result.data),
    };
  };
}
