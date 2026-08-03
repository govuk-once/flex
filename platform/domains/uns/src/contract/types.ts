import { ApiResult } from "@flex/sdk";
import { APIGatewayProxyEvent } from "aws-lambda";

import type { UnsRemoteClient } from "../client/index";
import {
  UnsGroupsGetRequestSchema,
  UnsGroupsPostRequestSchema,
  UnsGroupsResponseSchema,
} from "../schemas/remote/groups";
import {
  GetNotificationResponseSchema,
  GetNotificationsResponseSchema,
  NotificationRequestSchema,
  NotificationsPatchRequestSchema,
  NotificationsRequestSchema,
} from "../schemas/remote/notification";

export type RouteOperation =
  | "getNotifications"
  | "getNotificationById"
  | "deleteNotificationById"
  | "patchNotificationById"
  | "getGroups"
  | "postGroups";

type BaseRouteContract<
  TOp extends RouteOperation,
  TMethod extends "GET" | "DELETE" | "PATCH" | "POST",
  TRemoteRequest,
  TRemoteResponse,
  TDomainResponse,
> = {
  operation: TOp;
  method: TMethod;
  inboundPath: string;
  remotePath: string;
  toRemote: (
    event: APIGatewayProxyEvent,
  ) => TRemoteRequest | Promise<TRemoteRequest>;
  callRemote: (
    client: UnsRemoteClient,
    input: TRemoteRequest,
  ) => Promise<ApiResult<TRemoteResponse>>;
  toDomain?: (remote: TRemoteResponse) => TDomainResponse;
};

export type GetNotificationsRouteContract = BaseRouteContract<
  "getNotifications",
  "GET",
  NotificationRequestSchema,
  unknown,
  GetNotificationsResponseSchema
>;

export type GetNotificationsByIdRouteContract = BaseRouteContract<
  "getNotificationById",
  "GET",
  NotificationsRequestSchema,
  unknown,
  GetNotificationResponseSchema
>;

export type DeleteNotificationsByIdRouteContract = BaseRouteContract<
  "deleteNotificationById",
  "DELETE",
  NotificationsRequestSchema,
  unknown,
  unknown
>;

export type PatchNotificationsByIdRouteContract = BaseRouteContract<
  "patchNotificationById",
  "PATCH",
  NotificationsPatchRequestSchema,
  unknown,
  unknown
>;

export type GetGroupsRouteContract = BaseRouteContract<
  "getGroups",
  "GET",
  UnsGroupsGetRequestSchema,
  unknown,
  UnsGroupsResponseSchema
>;

export type PostGroupsRouteContract = BaseRouteContract<
  "postGroups",
  "POST",
  UnsGroupsPostRequestSchema,
  unknown,
  UnsGroupsResponseSchema
>;

export type RouteContract =
  | GetNotificationsRouteContract
  | GetNotificationsByIdRouteContract
  | DeleteNotificationsByIdRouteContract
  | PatchNotificationsByIdRouteContract
  | GetGroupsRouteContract
  | PostGroupsRouteContract;
