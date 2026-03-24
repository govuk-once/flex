import { ApiResult } from "@flex/flex-fetch";
import { APIGatewayProxyEvent } from "aws-lambda";

import type { DvlaRemoteClient } from "../client/index";
import { AuthenticateResponseSchema } from "../schemas/remote/authenticate";
import {
  GetCustomerRequestSchema,
  GetCustomerResponseSchema,
} from "../schemas/remote/customer";
import {
  GetLicenceRequestSchema,
  GetLicenceResponseSchema,
} from "../schemas/remote/drivingLicences";

export type RouteOperation =
  | "getAuthenticate"
  | "getRetrieveCustomer"
  | "getRetrieveDrivingLicences";

type BaseRouteContract<
  TOp extends RouteOperation,
  TMethod extends "GET",
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

export type RouteContract =
  | GetDrivingLicenceRetrieveRouteContract
  | GetAuthenticateRouteContract
  | GetCustomerRetrieveRouteContract;
