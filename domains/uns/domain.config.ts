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
    gdsGatewayUrl: {
      type: "ssm",
      path: "/gds/apigw/gateway-url",
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
            resources: ["gdsGatewayUrl", "unsNotificationSecret"],
          },
        },
      },
      "/notifications/:notificationId": {
        GET: {
          public: {
            name: "get-notification-by-id",
            response: NotificationSchema,
          },
        },
        DELETE: {
          public: {
            name: "delete-notification",
          },
        },
      },
      "/notifications/:notificationId/status": {
        PATCH: {
          public: {
            name: "patch-notification-status",
            body: PatchNotificationBodySchema,
          },
        },
      },
    },
  },
});

export const getNotificationsContext = routeContext<"GET /v1/notifications">;
