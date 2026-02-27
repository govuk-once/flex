import { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";

import type { UdpRemoteClient } from "../client";
import { DomainNotificationsResponse } from "../schemas/domain/notifications";
import type {
  CreateOrUpdateNotificationsRequest,
  CreateOrUpdateNotificationsResponse,
  GetNotificationsRequest,
  NotificationsResponse,
} from "../schemas/remote/notifications";
import { CreateUserRequest, CreateUserResponse } from "../schemas/remote/user";

export type RouteOperation =
  | "getNotificationPreferences"
  | "updateNotificationPreferences"
  | "createUser";

type BaseRouteContract<
  TOp extends RouteOperation,
  TMethod extends "GET" | "POST" | "PUT" | "PATCH",
  TRemoteRequest,
  TRemoteResponse,
  TDomainResponse,
> = {
  operation: TOp;
  method: TMethod;
  inboundPath: string;
  remotePath: string;
  toRemote: (event: APIGatewayProxyEvent) => Promise<TRemoteRequest>;
  callRemote: (
    client: UdpRemoteClient,
    input: TRemoteRequest,
  ) => Promise<ApiResult<TRemoteResponse>>;
  toDomain?: (remote: TRemoteResponse) => TDomainResponse;
};

export type GetNotificationPreferencesRouteContract = BaseRouteContract<
  "getNotificationPreferences",
  "GET",
  GetNotificationsRequest,
  NotificationsResponse,
  DomainNotificationsResponse
>;

export type UpdateNotificationPreferencesRouteContract = BaseRouteContract<
  "updateNotificationPreferences",
  "POST",
  CreateOrUpdateNotificationsRequest,
  CreateOrUpdateNotificationsResponse,
  DomainNotificationsResponse
>;

export type CreateUserRouteContract = BaseRouteContract<
  "createUser",
  "POST",
  CreateUserRequest,
  unknown,
  CreateUserResponse
>;

export type RouteContract =
  | GetNotificationPreferencesRouteContract
  | UpdateNotificationPreferencesRouteContract
  | CreateUserRouteContract;
