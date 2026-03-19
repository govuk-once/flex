import { ApiResult } from "@flex/flex-fetch";
import type { APIGatewayProxyEvent } from "aws-lambda";

import type { UdpRemoteClient } from "../client";
import { RequestingServiceUserIdHeader } from "../schemas/common";
import { DomainNotificationsResponse } from "../schemas/domain/notifications";
import {
  CreateIdentityRequest,
  DeleteIdentityRequest,
  GetIdentityRequest,
  GetIdentityResponse,
  IdentityResponse,
} from "../schemas/remote/identity";
import type {
  CreateOrUpdateNotificationsRequest,
  CreateOrUpdateNotificationsResponse,
  NotificationsResponse,
} from "../schemas/remote/notifications";
import { CreateUserRequest, CreateUserResponse } from "../schemas/remote/user";

export type RouteOperation =
  | "getNotificationPreferences"
  | "updateNotificationPreferences"
  | "createUser"
  | "createIdentityLink"
  | "deleteIdentityLink"
  | "getIdentityLink";

type BaseRouteContract<
  TOp extends RouteOperation,
  TMethod extends "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
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
    client: UdpRemoteClient,
    input: TRemoteRequest,
  ) => Promise<ApiResult<TRemoteResponse>>;
  toDomain?: (remote: TRemoteResponse) => TDomainResponse;
};

export type GetNotificationPreferencesRouteContract = BaseRouteContract<
  "getNotificationPreferences",
  "GET",
  RequestingServiceUserIdHeader,
  NotificationsResponse,
  DomainNotificationsResponse
>;

export type UpdateNotificationPreferencesRouteContract = BaseRouteContract<
  "updateNotificationPreferences",
  "POST",
  CreateOrUpdateNotificationsRequest & RequestingServiceUserIdHeader,
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

export type CreateIdentityLinkRouteContract = BaseRouteContract<
  "createIdentityLink",
  "POST",
  CreateIdentityRequest,
  unknown,
  IdentityResponse
>;

export type DeleteIdentityLinkRouteContract = BaseRouteContract<
  "deleteIdentityLink",
  "DELETE",
  DeleteIdentityRequest,
  unknown,
  IdentityResponse
>;

export type GetIdentityLinkRouteContract = BaseRouteContract<
  "getIdentityLink",
  "GET",
  GetIdentityRequest,
  unknown,
  GetIdentityResponse
>;

export type RouteContract =
  | GetNotificationPreferencesRouteContract
  | UpdateNotificationPreferencesRouteContract
  | CreateUserRouteContract
  | CreateIdentityLinkRouteContract
  | DeleteIdentityLinkRouteContract
  | GetIdentityLinkRouteContract;
