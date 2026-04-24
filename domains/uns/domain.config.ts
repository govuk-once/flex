import { domain } from "@flex/sdk";
import { GetUserPushIdResponseSchema } from "@flex/udp-domain";

import {
  NotificationSchema,
  NotificationsResponseSchema,
  PatchNotificationBodySchema,
} from "./src/schemas/notification";

export const { config, route } = domain({
  name: "uns",
  common: {
    access: "isolated",
    function: { timeoutSeconds: 30 },
  },
  resources: {
    flexPrivateGatewayUrl: {
      type: "ssm",
      path: "/flex/privateGatewayUrl",
      scope: "stage",
    },
    unsFlexPrivateGatewayUrl: {
      type: "ssm",
      path: "/uns/flex/privateGatewayUrl",
      scope: "stage",
    },
  },
  integrations: {
    udpGetPushId: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/users/push-id",
      response: GetUserPushIdResponseSchema,
    },
  },
  routes: {
    v1: {
      "/notifications": {
        GET: {
          public: {
            name: "get-notifications",
            response: NotificationsResponseSchema,
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
