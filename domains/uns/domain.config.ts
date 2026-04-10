import { domain } from "@flex/sdk";
import { z } from "zod";

import {
  NotificationSchema,
  PatchNotificationBodySchema,
} from "./src/schemas/notification";

export const { config, route, routeContext } = domain({
  name: "uns",
  common: {
    access: "isolated",
    function: { timeoutSeconds: 30 },
  },
  resources: {
    flexPrivateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
    unsNotificationSecret: {
      type: "secret",
      path: "/flex-secret/uns/notification-hash-secret",
    },
  },
  routes: {
    v1: {
      "/notifications": {
        GET: {
          public: {
            name: "get-notifications",
            response: z.array(NotificationSchema),
            resources: ["flexPrivateGatewayUrl", "unsNotificationSecret"],
          },
        },
      },
      "/notifications/:notificationId": {
        GET: {
          public: {
            name: "get-notification-by-id",
            response: NotificationSchema,
            resources: ["flexPrivateGatewayUrl", "unsNotificationSecret"],
          },
        },
        DELETE: {
          public: {
            name: "delete-notification",
            resources: ["flexPrivateGatewayUrl", "unsNotificationSecret"],
          },
        },
      },
      "/notifications/:notificationId/status": {
        PATCH: {
          public: {
            name: "patch-notification-status",
            body: PatchNotificationBodySchema,
            resources: ["flexPrivateGatewayUrl", "unsNotificationSecret"],
          },
        },
      },
    },
  },
});

export const getNotificationsContext = routeContext<"GET /v1/notifications">;
export const getNotificationByIdContext =
  routeContext<"GET /v1/notifications/:notificationId">;
export const deleteNotificationContext =
  routeContext<"DELETE /v1/notifications/:notificationId">;
export const patchNotificationStatusContext =
  routeContext<"PATCH /v1/notifications/:notificationId/status">;
