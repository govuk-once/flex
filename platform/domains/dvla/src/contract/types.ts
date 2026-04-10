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
import { PostTestNotificationRequestSchema } from "../schemas/remote/testNotification";

export type RouteOperation =
  | "getAuthenticate"
  | "getRetrieveCustomer"
  | "getRetrieveDrivingLicences"
  | "postTestNotification"
  | "getDriverSummary"
  | "getCustomerSummary";

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

export type PostDrivingTestNotification = BaseRouteContract<
  "postTestNotification",
  "POST",
  PostTestNotificationRequestSchema,
  unknown,
  unknown
>;

export type RouteContract =
  | GetAuthenticateRouteContract
  | GetCustomerRetrieveRouteContract
  | GetCustomerSummaryRouteContract
  | GetDriverSummaryRouteContract
  | GetDrivingLicenceRetrieveRouteContract
  | PostDrivingTestNotification;
