import { ApiResult } from "@flex/flex-fetch";
import { APIGatewayProxyEvent } from "aws-lambda";

import type { DvlaRemoteClient } from "../client/index";
import { AuthenticateResponseSchema } from "../schemas/remote/authenticate";
import {
  GetCustomerRequestSchema,
  GetCustomerResponseSchema,
} from "../schemas/remote/customer";
import {
  GetCustomerSummaryRequestSchema,
  GetCustomerSummaryResponseSchema,
} from "../schemas/remote/customerSummary";
import {
  GetDriverSummaryRequestSchema,
  GetDriverSummaryResponseSchema,
} from "../schemas/remote/driverSummary";
import {
  GetLicenceRequestSchema,
  GetLicenceResponseSchema,
} from "../schemas/remote/drivingLicences";
import {
  MultiShareCodeResponse,
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
  | "getRetrieveCustomer"
  | "getRetrieveDrivingLicences"
  | "postTestNotification"
  | "getDriverSummary"
  | "getCustomerSummary"
  | "getVehicleEnquiryService"
  | "postShareCode"
  | "postShareCodeCancel"
  | "getShareCodes"
  | "postUnlinkUser";

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

export type GetCustomerRetrieveRouteContract = BaseRouteContract<
  "getRetrieveCustomer",
  "GET",
  GetCustomerRequestSchema,
  unknown,
  GetCustomerResponseSchema
>;

export type GetDrivingLicenceRetrieveRouteContract = BaseRouteContract<
  "getRetrieveDrivingLicences",
  "GET",
  GetLicenceRequestSchema,
  unknown,
  GetLicenceResponseSchema
>;

export type GetDriverSummaryRouteContract = BaseRouteContract<
  "getDriverSummary",
  "GET",
  GetDriverSummaryRequestSchema,
  unknown,
  GetDriverSummaryResponseSchema
>;

export type GetCustomerSummaryRouteContract = BaseRouteContract<
  "getCustomerSummary",
  "GET",
  GetCustomerSummaryRequestSchema,
  unknown,
  GetCustomerSummaryResponseSchema
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

export type GetShareCodes = BaseRouteContract<
  "getShareCodes",
  "GET",
  ShareCodeRequestSchema,
  unknown,
  MultiShareCodeResponse
>;

export type PostUnlinkUser = BaseRouteContract<
  "postUnlinkUser",
  "POST",
  UnlinkUserRequestSchema,
  unknown,
  unknown
>;

export type RouteContract =
  | GetAuthenticateRouteContract
  | GetWellKnownJwkRouteContract
  | GetCustomerRetrieveRouteContract
  | GetCustomerSummaryRouteContract
  | GetDriverSummaryRouteContract
  | GetDrivingLicenceRetrieveRouteContract
  | PostDrivingTestNotification
  | GetVehicleEnquiryServiceRouteContract
  | PostShareCode
  | PostShareCodeCancel
  | GetShareCodes
  | PostUnlinkUser;
