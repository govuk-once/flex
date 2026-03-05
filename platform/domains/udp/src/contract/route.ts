import { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";
import z from "zod";

import { inboundCreateOrUpdateNotificationsRequestSchema } from "../schemas/domain/notifications";
import { inboundCreateUserRequestSchema } from "../schemas/domain/user";
import type { RouteContract } from "./types";

const INTERNAL_ROUTES = {
  user: "/v1/users",
  notifications: "/v1/notifications",
} as const;

export const UDP_REMOTE_BASE = "/v1";

export const UDP_REMOTE_ROUTES = {
  notifications: `${UDP_REMOTE_BASE}/notifications`,
  user: `${UDP_REMOTE_BASE}/user`,
  identity: `${UDP_REMOTE_BASE}/identity`,
} as const;

export const ROUTE_CONTRACTS = {
  /** TODO update the below to match new structure */
  // "POST:/v1/identity": {
  //   operation: "createIdentityLink",
  //   method: "POST",
  //   inboundPath: "/v1/identity",
  //   remotePath: "/v1/identity",
  //   remoteExecutor: makeExecuteRemote(
  //     async (event) => {
  //       /** /v1/identity/{serviceName}/{identifier} */
  //       const pathParams = normalizeInboundPath(event.path).split("/");

  //       const serviceName = pathParams[3];
  //       const identifier = pathParams[4];

  //       if (!serviceName || !identifier) {
  //         throw new createHttpError.BadRequest(
  //           "Missing serviceName or identifier in path",
  //         );
  //       }

  //       return {
  //         serviceName,
  //         identifier,
  //         remoteBody: await parseAndMapBody(
  //           identityRequestSchema,
  //           (inbound) => inbound,
  //           event,
  //         ),
  //       };
  //     },
  //     (client, { serviceName, identifier, remoteBody }) =>
  //       client.createServiceLink(serviceName, identifier, remoteBody),
  //     () => undefined,
  //   ),
  // },
  "POST:/v1/users": {
    operation: "createUser",
    method: "POST",
    inboundPath: INTERNAL_ROUTES.user,
    remotePath: UDP_REMOTE_ROUTES.user,
    toRemote: async (event) => {
      const data = await parseAndMapBody(inboundCreateUserRequestSchema, event);
      return {
        notificationId: data.notificationId,
        appId: data.userId,
      };
    },
    callRemote: (client, data) => client.user.create(data),
  },
  "POST:/v1/notifications": {
    operation: "updateNotificationPreferences",
    method: "POST",
    inboundPath: INTERNAL_ROUTES.notifications,
    remotePath: UDP_REMOTE_ROUTES.notifications,
    toRemote: async (event) => {
      const data = await parseAndMapBody(
        inboundCreateOrUpdateNotificationsRequestSchema,
        event,
      );
      const requestingServiceUserId = assertRequiredHeaderAndReturn(
        event,
        "requesting-service-user-id",
      );
      return { data, requestingServiceUserId };
    },
    callRemote: (client, data) =>
      client.notifications.update(data, data.requestingServiceUserId),
    toDomain: (remote) => remote.data,
  },
  "GET:/v1/notifications": {
    operation: "getNotificationPreferences",
    method: "GET",
    inboundPath: INTERNAL_ROUTES.notifications,
    remotePath: UDP_REMOTE_ROUTES.notifications,
    toRemote: (event) => {
      const requestingServiceUserId = assertRequiredHeaderAndReturn(
        event,
        "requesting-service-user-id",
      );
      return Promise.resolve({ requestingServiceUserId });
    },
    callRemote: (client, data) =>
      client.notifications.get(data.requestingServiceUserId),
    toDomain: (remote) => remote.data,
  },
} as const satisfies Record<string, RouteContract>;

// export function matchToRouteContract(
//   method: string,
//   path: string,
// ): RouteContract | undefined {
//   const key = `${method.toUpperCase()}:${path}`;
//   if (key in ROUTE_CONTRACTS) {
//     return ROUTE_CONTRACTS[key as keyof typeof ROUTE_CONTRACTS];
//   }
//
//   /**
//    * Dynamic identity path for identity due to /{serviceName}/{identifier}
//    */
//   if (method.toUpperCase() === "POST" && path.startsWith("/v1/identity/")) {
//     return ROUTE_CONTRACTS["POST:/v1/identity"];
//   }
//
//   return undefined;
// }

async function parseAndMapBody<T extends z.ZodType>(
  schema: T,
  event: APIGatewayProxyEvent,
): Promise<z.infer<T>> {
  const body = parseRequestBody(event.body);
  const result = await schema.safeParseAsync(body);
  if (!result.success) {
    throw new createHttpError.BadRequest();
  }
  return result.data;
}

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

function parseRequestBody(body: string | null): unknown {
  if (!body) {
    throw new createHttpError.BadRequest("Missing request body");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new createHttpError.BadRequest("Invalid JSON body");
  }
}
