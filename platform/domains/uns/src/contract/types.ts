import { ApiResult } from "@flex/flex-fetch";
import { APIGatewayProxyEvent } from "aws-lambda";

import type { UnsRemoteClient } from "../client/index";
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
  | "patchNotificationById";

type BaseRouteContract<
  TOp extends RouteOperation,
  TMethod extends "GET" | "DELETE" | "PATCH",
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

export type RouteContract =
  | GetNotificationsRouteContract
  | GetNotificationsByIdRouteContract
  | DeleteNotificationsByIdRouteContract
  | PatchNotificationsByIdRouteContract;
