import { domain } from "@flex/sdk";
import { z } from "zod";

import {
  NotificationSchema,
  PatchNotificationBodySchema,
} from "./src/schemas/notification";

const { config, route, routeContext } = domain({
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

export const getNotificationsContext = routeContext<"GET /v1/notifications">;
export const getNotificationByIdContext =
  routeContext<"GET /v1/notifications/:notificationId">;
export const deleteNotificationContext =
  routeContext<"DELETE /v1/notifications/:notificationId">;
export const patchNotificationStatusContext =
  routeContext<"PATCH /v1/notifications/:notificationId/status">;

export { config, route };
