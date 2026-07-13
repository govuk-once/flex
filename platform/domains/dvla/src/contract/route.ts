import { getHeader } from "@flex/utils";
import { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import { normalizeInboundPath } from "../utils/normalizeInboundPath";
import { RouteContract } from "./types";

export const DVLA_REMOTE_ROUTES = {
  authenticate: `/thirdparty-access/v1`,
  app: `/govuk-app-service/v1`,
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
  "GET:/v1/well-known-jwks": {
    operation: "getWellKnownJwk",
    method: "GET",
    inboundPath: "/v1/well-known-jwks",
    remotePath: "",
    toRemote: () => { },
    callRemote: (client) => client.wellKnownJwk.get(),
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
  "GET:/v1/customer/licence": {
    operation: "getCustomerLicence",
    method: "GET",
    inboundPath: "/v1/customer/licence",
    remotePath: "/v1/customer/licence",
    toRemote: (event) => {
      const jwt = assertRequiredHeaderAndReturn(event, "auth");
      const id = event.queryStringParameters?.linkingId;
      if (!id) {
        throw new createHttpError.BadRequest(
          "Missing linking-id query parameter",
        );
      }

      return { id, jwt };
    },
    callRemote: (client, data) =>
      client.customerDrivingLicence.get(data.id, data.jwt),
  },
  "GET:/v1/customer/vehicle/:id": {
    operation: "getCustomerVehicle",
    method: "GET",
    inboundPath: "/v1/customer/vehicle/:id",
    remotePath: "/v1/customer/vehicle/:id",
    toRemote: (event) => {
      const pathParams = normalizeInboundPath(event.path).split("/");
      const vehicleId = pathParams[4];

      if (!vehicleId) {
        throw new createHttpError.BadRequest("Missing vehicleId form path");
      }

      const jwt = assertRequiredHeaderAndReturn(event, "auth");
      const id = event.queryStringParameters?.linkingId;
      if (!id) {
        throw new createHttpError.BadRequest(
          "Missing linking-id query parameter",
        );
      }

      return { id, jwt, vehicleId };
    },
    callRemote: (client, data) =>
      client.customerVehicle.get(data.id, data.jwt, data.vehicleId),
  },
  "GET:/v1/customer/vehicles": {
    operation: "getCustomerVehicles",
    method: "GET",
    inboundPath: "/v1/customer/vehicles",
    remotePath: "/v1/customer/vehicles",
    toRemote: (event) => {
      const jwt = assertRequiredHeaderAndReturn(event, "auth");
      const id = event.queryStringParameters?.linkingId;
      if (!id) {
        throw new createHttpError.BadRequest(
          "Missing linking-id query parameter",
        );
      }

      return { id, jwt };
    },
    callRemote: (client, data) =>
      client.customerVehicles.get(data.id, data.jwt),
  },
  "GET:/v1/vehicle-enquiry": {
    operation: "getVehicleEnquiryService",
    method: "GET",
    inboundPath: "/v1/vehicle-enquiry",
    remotePath: "/v1/vehicle-enquiry",
    toRemote: (event) => {
      const jwt = assertRequiredHeaderAndReturn(event, "auth");
      const pathParams = normalizeInboundPath(event.path).split("/");
      const registrationNumber = pathParams[3];

      if (!registrationNumber) {
        throw new createHttpError.BadRequest(
          "Missing registrationNumber form path",
        );
      }
      return { registrationNumber, jwt };
    },
    callRemote: (client, data) => client.vehicle.get(data.registrationNumber, data.jwt),
  },
  "POST:/v1/share-code/:id/cancel": {
    operation: "postShareCodeCancel",
    method: "POST",
    inboundPath: "/v1/share-codes",
    remotePath: "/v1/share-codes",
    toRemote: (event) => {
      const jwt = assertRequiredHeaderAndReturn(event, "auth");
      const id = event.queryStringParameters?.linkingId;
      if (!id) {
        throw new createHttpError.BadRequest(
          "Missing linking-id query parameter",
        );
      }

      const pathParams = normalizeInboundPath(event.path).split("/");
      const shareCodeId = pathParams[3];
      if (!shareCodeId) {
        throw new createHttpError.BadRequest("Missing shareCodeid in path");
      }
      return { id, jwt, shareCodeId };
    },
    callRemote: (client, data) =>
      client.cancelShareCode.post(data.id, data.jwt, data.shareCodeId),
  },
  "POST:/v1/share-code": {
    operation: "postShareCode",
    method: "POST",
    inboundPath: "/v1/share-codes",
    remotePath: "/v1/share-codes",
    toRemote: (event) => {
      const jwt = assertRequiredHeaderAndReturn(event, "auth");
      const id = event.queryStringParameters?.linkingId;
      if (!id) {
        throw new createHttpError.BadRequest(
          "Missing linking-id query parameter",
        );
      }

      return { id, jwt };
    },
    callRemote: (client, data) => client.shareCode.post(data.id, data.jwt),
  },
  "POST:/v1/unlink-user/:id": {
    operation: "postUnlinkUser",
    method: "POST",
    inboundPath: "/v1/unlink-user",
    remotePath: "/v1/unlink-user",
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
    callRemote: (client, data) => client.unlink.post(data.id, data.jwt),
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
