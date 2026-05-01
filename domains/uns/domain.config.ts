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
    encryptionKey: { type: "kms", path: "/flex-secret/encryption-key" },
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
    udpNotificationSecret: {
      type: "secret",
      path: "/flex-secret/udp/notification-hash-secret",
    },
  },
  integrations: {
    unsGetNotifications: {
      type: "gateway",
      target: "uns",
      route: "GET /v1/notifications",
      response: NotificationsResponseSchema,
    },
    unsGetNotificationById: {
      type: "gateway",
      target: "uns",
      route: "GET /v1/notifications/*",
      response: NotificationSchema,
    },
    udpGetPushId: {
      type: "domain",
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
            resources: [
              "encryptionKey",
              "privateGatewayUrl",
              "udpNotificationSecret",
            ],
            integrations: ["unsGetNotifications", "udpGetPushId"],
          },
        },
      },
      "/notifications/:notificationId": {
        GET: {
          public: {
            name: "get-notification-by-id",
            response: NotificationSchema,
            resources: [
              "encryptionKey",
              "privateGatewayUrl",
              "udpNotificationSecret",
            ],
            integrations: ["unsGetNotificationById", "udpGetPushId"],
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
