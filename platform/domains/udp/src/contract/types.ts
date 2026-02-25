import type { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";

import type { UdpRemoteClient } from "../client";

export type RouteOperation =
  | "getNotifications"
  | "updateNotifications"
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

export type GetNotificationsRouteContract = BaseRouteContract<
  "getNotifications",
  "GET",
  unknown
>;

export type UpdateNotificationsRouteContract = BaseRouteContract<
  "updateNotifications",
  "POST",
  unknown
>;

export type CreateUserRouteContract = BaseRouteContract<
  "createUser",
  "POST",
  unknown
>;

export type RouteContract =
  | GetNotificationsRouteContract
  | UpdateNotificationsRouteContract
  | CreateUserRouteContract;
