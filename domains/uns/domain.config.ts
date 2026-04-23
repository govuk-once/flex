import { domain } from "@flex/sdk";
import { z } from "zod";

import {
  NotificationSchema,
  PatchNotificationBodySchema,
} from "./src/schemas/notification";
import { GetUserPushIdResponseSchema } from "@flex/udp-domain";

export const { config, route, routeContext } = domain({
  name: "uns",
  common: {
    access: "isolated",
    function: { timeoutSeconds: 30 },
  },
  resources: {
    unsFlexPrivateGatewayUrl: {
      type: "ssm",
      path: "/uns/flex/privateGatewayUrl",
      scope: "stage",
    },
    integrations: {
      udpGetPushId: {
        type: "domain",
        target: "udp",
        route: "GET /v1/users/push-id",
        response: GetUserPushIdResponseSchema,
      }
    },
  },
  routes: {
    v1: {
      "/notifications": {
        GET: {
          public: {
            name: "get-notifications",
            response: z.array(NotificationSchema),
            resources: ["unsFlexPrivateGatewayUrl"],
            integrations: ["udpGetPushId"],
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
