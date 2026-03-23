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
  routes: {
    v1: {
      "/notifications": {
        GET: {
          public: {
            name: "get-notifications",
            response: z.array(NotificationSchema),
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
