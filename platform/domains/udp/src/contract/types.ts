import type { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";

import type { UdpRemoteClient } from "../client";

export type RouteOperation =
  | "getNotificationPreferences"
  | "updateNotificationPreferences"
  | "createUser";

type BaseRouteContract<
  TOp extends RouteOperation,
  TMethod extends "GET" | "POST" | "PUT" | "PATCH",
  TDomainResponse,
> = {
  operation: TOp;
  method: TMethod;
  inboundPath: string;
  remotePath: string;
  remoteExecutor: (
    event: APIGatewayProxyEvent,
    client: UdpRemoteClient,
  ) => Promise<ApiResult<TDomainResponse>>;
};

export type GetNotificationPreferencesRouteContract = BaseRouteContract<
  "getNotificationPreferences",
  "GET",
  unknown
>;

export type UpdateNotificationPreferencesRouteContract = BaseRouteContract<
  "updateNotificationPreferences",
  "POST",
  unknown
>;

export type CreateUserRouteContract = BaseRouteContract<
  "createUser",
  "POST",
  unknown
>;

export type RouteContract =
  | GetNotificationPreferencesRouteContract
  | UpdateNotificationPreferencesRouteContract
  | CreateUserRouteContract;
