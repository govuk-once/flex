import { ApiResult } from "@flex/sdk";
import { APIGatewayProxyEvent } from "aws-lambda";

import type { DvlaRemoteClient } from "../client/index";
import { AuthenticateResponseSchema } from "../schemas/remote/authenticate";
import {
  CustomerDriversLicenceResponse,
  CustomerDrivingLicenceRequestSchema,
} from "../schemas/remote/custmerDrivingLicence";
import {
  CustomerVehicleRequestSchema,
  CustomerVehicleResponse,
} from "../schemas/remote/customerVehicle";
import {
  CustomerVehiclesRequestSchema,
  CustomerVehiclesResponse,
} from "../schemas/remote/customerVehicles";
import {
  PostShareCodeCancelRequestSchema,
  ShareCodeRequestSchema,
  SingleShareCodeResponse,
} from "../schemas/remote/shareCode";
import { PostTestNotificationRequestSchema } from "../schemas/remote/testNotification";
import { UnlinkUserRequestSchema } from "../schemas/remote/unlinkUser";
import {
  VehicleEnquiryRequestBodySchema,
  VehicleEnquiryResponseSchema,
} from "../schemas/remote/vehicleEnquiry";
import { JwkSet } from "../schemas/remote/wellKnownJwk";

export type RouteOperation =
  | "getAuthenticate"
  | "getWellKnownJwk"
  | "postTestNotification"
  | "getVehicleEnquiryService"
  | "postShareCode"
  | "postShareCodeCancel"
  | "postUnlinkUser"
  | "getCustomerVehicles"
  | "getCustomerVehicle"
  | "getCustomerLicence";

type BaseRouteContract<
  TOp extends RouteOperation,
  TMethod extends "GET" | "POST",
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
    client: DvlaRemoteClient,
    input: TRemoteRequest,
  ) => Promise<ApiResult<TRemoteResponse>>;
  toDomain?: (remote: TRemoteResponse) => TDomainResponse;
};

export type GetAuthenticateRouteContract = BaseRouteContract<
  "getAuthenticate",
  "GET",
  unknown,
  unknown,
  AuthenticateResponseSchema
>;

export type GetWellKnownJwkRouteContract = BaseRouteContract<
  "getWellKnownJwk",
  "GET",
  unknown,
  unknown,
  JwkSet
>;

export type GetVehicleEnquiryServiceRouteContract = BaseRouteContract<
  "getVehicleEnquiryService",
  "GET",
  VehicleEnquiryRequestBodySchema,
  unknown,
  VehicleEnquiryResponseSchema
>;

export type PostDrivingTestNotification = BaseRouteContract<
  "postTestNotification",
  "POST",
  PostTestNotificationRequestSchema,
  unknown,
  unknown
>;

export type PostShareCode = BaseRouteContract<
  "postShareCode",
  "POST",
  ShareCodeRequestSchema,
  unknown,
  SingleShareCodeResponse
>;

export type PostShareCodeCancel = BaseRouteContract<
  "postShareCodeCancel",
  "POST",
  PostShareCodeCancelRequestSchema,
  unknown,
  SingleShareCodeResponse
>;

export type PostUnlinkUser = BaseRouteContract<
  "postUnlinkUser",
  "POST",
  UnlinkUserRequestSchema,
  unknown,
  unknown
>;

export type GetCustomerVehicleRouteContract = BaseRouteContract<
  "getCustomerVehicle",
  "GET",
  CustomerVehicleRequestSchema,
  unknown,
  CustomerVehicleResponse
>;

export type GetCustomerVehiclesRouteContract = BaseRouteContract<
  "getCustomerVehicles",
  "GET",
  CustomerVehiclesRequestSchema,
  unknown,
  CustomerVehiclesResponse
>;

export type GetCustomerDrivingLicenceRouteContract = BaseRouteContract<
  "getCustomerLicence",
  "GET",
  CustomerDrivingLicenceRequestSchema,
  unknown,
  CustomerDriversLicenceResponse
>;

export type RouteContract =
  | GetAuthenticateRouteContract
  | GetWellKnownJwkRouteContract
  | PostDrivingTestNotification
  | GetVehicleEnquiryServiceRouteContract
  | PostShareCode
  | PostShareCodeCancel
  | PostUnlinkUser
  | GetCustomerVehicleRouteContract
  | GetCustomerVehiclesRouteContract
  | GetCustomerDrivingLicenceRouteContract;
