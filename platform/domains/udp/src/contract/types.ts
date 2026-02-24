import type { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { z } from "zod";

import type { UdpRemoteClient } from "../client";
import { inboundPreferencesRequestSchema } from "../schemas/inbound/preferences";
import { inboundCreateUserRequestSchema } from "../schemas/inbound/user";
import type { PreferencesRequest } from "../schemas/remote/preferences";
import type { CreateUserRequest } from "../schemas/remote/user";

export type RouteOperation =
  | "getNotifications"
  | "updateNotifications"
  | "createUser";

type BaseRouteContract<
  TOp extends RouteOperation,
  TMethod extends "GET" | "POST" | "PUT" | "PATCH",
  TRemoteResponse,
> = {
  operation: TOp;
  method: TMethod;
  inboundPath: string;
  remotePath: string;
  fromRemoteResponse?: (remote: TRemoteResponse) => unknown;
};

export interface GetContract<
  TOp extends RouteOperation,
  TContext extends object,
  TRemoteResponse,
> extends BaseRouteContract<TOp, "GET", TRemoteResponse> {
  method: "GET";
  buildContext: (event: APIGatewayProxyEvent) => TContext;
  callRemote: (
    client: UdpRemoteClient,
    input: TContext,
  ) => Promise<ApiResult<TRemoteResponse>>;
}

export interface MutationContract<
  TOp extends RouteOperation,
  TSchema extends z.ZodType,
  TRemoteBody,
  TContext extends object,
  TRemoteResponse,
> extends BaseRouteContract<TOp, "POST" | "PUT" | "PATCH", TRemoteResponse> {
  method: "POST" | "PUT" | "PATCH";
  inboundSchema: TSchema;
  toRemoteBody: (inbound: z.output<TSchema>) => TRemoteBody;
  buildContext: (event: APIGatewayProxyEvent) => TContext;
  callRemote: (
    client: UdpRemoteClient,
    input: TContext & { remoteBody: TRemoteBody },
  ) => Promise<ApiResult<TRemoteResponse>>;
}

export type GetNotificationsRouteContract = GetContract<
  "getNotifications",
  { requestingServiceUserId: string },
  unknown
>;

export type UpdateNotificationsRouteContract = MutationContract<
  "updateNotifications",
  typeof inboundPreferencesRequestSchema,
  PreferencesRequest,
  { requestingServiceUserId: string },
  unknown
>;

export type CreateUserRouteContract = MutationContract<
  "createUser",
  typeof inboundCreateUserRequestSchema,
  CreateUserRequest,
  Record<string, never>,
  unknown
>;

export type RouteContract =
  | GetNotificationsRouteContract
  | UpdateNotificationsRouteContract
  | CreateUserRouteContract;

export type MutationRouteContract = Extract<
  RouteContract,
  { method: "POST" | "PUT" | "PATCH" }
>;
