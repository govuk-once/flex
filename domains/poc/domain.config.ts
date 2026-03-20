import { domain } from "@flex/sdk";
import {
  createNotificationRequestSchema,
  createNotificationResponseSchema,
  createUserRequestSchema,
  getNotificationResponseSchema,
  getUserPreferencesResponseSchema,
  updateNotificationRequestSchema,
  updateNotificationResponseSchema,
} from "@flex/udp-domain";

const { config, route, routeContext } = domain({
  name: "poc",
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
    encryptionKeyArn: { type: "kms", path: "/flex-secret/encryption-key" },
    udpNotificationSecret: {
      type: "secret",
      path: "/flex-secret/udp/notification-hash-secret",
    },
  },
  featureFlags: {
    newUserProfileEnabled: {
      description: "Enable the new user profile experience",
      default: false,
      environments: {
        development: true,
        staging: true,
        production: false,
      },
    },
  },
  integrations: {
    udpWrite: { type: "gateway", target: "udp", route: "POST /v1/*" },
    udpCreateUser: { type: "gateway", target: "udp", route: "POST /v1/user" },
    udpGetNotifications: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/notifications",
      response: getNotificationResponseSchema,
    },
    udpPostNotifications: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/notifications",
      body: createNotificationRequestSchema,
      response: createNotificationResponseSchema,
    },
  },
  routes: {
    v0: {
      "/identity/:serviceName/:identifier": {
        POST: {
          public: {
            name: "create-identity-link",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["udpWrite"],
          },
        },
      },
      "/users": {
        GET: {
          public: {
            name: "get-user-preferences",
            resources: [
              "flexPrivateGatewayUrl",
              "encryptionKeyArn",
              "udpNotificationSecret",
            ],
            integrations: [
              "udpWrite",
              "udpGetNotifications",
              "udpPostNotifications",
            ],
            featureFlags: ["newUserProfileEnabled"],
            response: getUserPreferencesResponseSchema,
          },
        },
        POST: {
          private: {
            name: "create-user",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["udpCreateUser"],
            body: createUserRequestSchema,
          },
        },
      },
      "/users/notifications": {
        PATCH: {
          public: {
            name: "update-user-notifications",
            resources: [
              "flexPrivateGatewayUrl",
              "encryptionKeyArn",
              "udpNotificationSecret",
            ],
            integrations: ["udpPostNotifications"],
            body: updateNotificationRequestSchema,
            response: updateNotificationResponseSchema,
          },
        },
      },
    },
  },
});

export const createIdentityContext =
  routeContext<"POST /v0/identity/:serviceName/:identifier">;
export const getUsersContext = routeContext<"GET /v0/users">;
export const createUserContext = routeContext<"POST /v0/users [private]">;
export const updateUserNotificationsContext =
  routeContext<"PATCH /v0/users/notifications">;

export { config, route };
