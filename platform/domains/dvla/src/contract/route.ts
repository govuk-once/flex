import { getHeader } from "@flex/utils";
import { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import { normalizeInboundPath } from "../utils/normalizeInboundPath";
import { RouteContract } from "./types";

export const DVLA_REMOTE_ROUTES = {
  authenticate: `/thirdparty-access/v1`,
  app: `/govuk-app-service/v1`,
  licence: `/full-driver-enquiry/v1`,
} as const;

export const ROUTE_CONTRACTS = {
  "GET:/v1/authenticate": {
    operation: "getAuthenticate",
    method: "GET",
    inboundPath: "/v1/authenticate",
    remotePath: "/v1/authenticate",
    toRemote: () => { },
    callRemote: (client) => client.authentication.get(),
  },
  "GET:/v1/licence/:id": {
    operation: "getRetrieveDrivingLicences",
    method: "GET",
    inboundPath: "/v1/licence",
    remotePath: "/v1/licence",
    toRemote: (event) => {
      const jwt = assertRequiredHeaderAndReturn(event, "auth");
      const pathParams = normalizeInboundPath(event.path).split("/");
      const id = pathParams[3];
      if (!id) {
        throw new createHttpError.BadRequest(
          "Missing customer linking id in path",
        );
      }

      return { id, jwt };
    },
    callRemote: (client, data) => client.licence.get(data.id, data.jwt),
  },
  "GET:/v1/customer/:id": {
    operation: "getRetrieveCustomer",
    method: "GET",
    inboundPath: "/v1/customer",
    remotePath: "/v1/customer",
    toRemote: (event) => {
      const jwt = assertRequiredHeaderAndReturn(event, "auth");
      const pathParams = normalizeInboundPath(event.path).split("/");
      const id = pathParams[3];
      if (!id) {
        throw new createHttpError.BadRequest(
          "Missing customer linking id in path",
        );
      }

      return { id, jwt };
    },
    callRemote: (client, data) => client.customer.get(data.id, data.jwt),
  },
  "POST:/v1/test-notification/:id": {
    operation: "postTestNotification",
    method: "POST",
    inboundPath: "/v1/test-notification",
    remotePath: "/v1/test-notification",
    toRemote: (event) => {
      const jwt = assertRequiredHeaderAndReturn(event, "auth");
      const pathParams = normalizeInboundPath(event.path).split("/");
      const id = pathParams[3];
      if (!id) {
        throw new createHttpError.BadRequest(
          "Missing customer linking id in path",
        );
      }

      return { id, jwt };
    },
    callRemote: (client, data) => client.notification.post(data.id, data.jwt),
  },
} as const satisfies Record<string, RouteContract>;

function assertRequiredHeaderAndReturn(
  event: APIGatewayProxyEvent,
  header: string,
): string {
  const value = getHeader(event, header);
  if (!value) {
    throw new createHttpError.BadRequest(`Missing ${header} header`);
  }
  return value;
}
