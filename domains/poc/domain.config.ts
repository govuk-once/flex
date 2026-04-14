import { domain } from "@flex/sdk";
import {
  CreateNotificationPreferencesRequestSchema,
  CreateNotificationPreferencesResponseSchema,
  CreateUserRequestSchema,
  GetUserPushIdResponseSchema,
  UpdateNotificationPreferencesRequestSchema,
} from "@flex/udp-domain";

import { UpdateNotificationPreferencesOutboundResponseWithFeatureFlagSchema } from "./schemas/notifications";

export const { config, route, routeContext } = domain({
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
      environments: ["development", "staging"],
    },
  },
  integrations: {
    udpCreateIdentityLink: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/identity/*",
    },
    udpCreateNotificationPreferences: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/notifications",
      body: CreateNotificationPreferencesRequestSchema,
      response: CreateNotificationPreferencesResponseSchema,
    },
    udpCreateUser: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/users",
      body: CreateUserRequestSchema,
    },
    udpGetPushId: {
      type: "domain",
      target: "udp",
      route: "GET /v1/users/push-id",
      response: GetUserPushIdResponseSchema,
    },
  },
  routes: {
    v0: {
      "/identity/:service/:id": {
        POST: {
          public: {
            name: "create-identity-link",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["udpCreateIdentityLink"],
            function: { timeoutSeconds: 20 },
          },
        },
      },
      "/users": {
        POST: {
          private: {
            name: "udp-create-user",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["udpCreateUser"],
            body: CreateUserRequestSchema,
          },
        },
      },
      "/users/notifications": {
        PATCH: {
          public: {
            name: "update-user-notification-preferences",
            resources: [
              "flexPrivateGatewayUrl",
              "encryptionKeyArn",
              "udpNotificationSecret",
            ],
            integrations: ["udpCreateNotificationPreferences", "udpGetPushId"],
            featureFlags: ["newUserProfileEnabled"],
            function: { timeoutSeconds: 20 },
            body: UpdateNotificationPreferencesRequestSchema,
            response:
              UpdateNotificationPreferencesOutboundResponseWithFeatureFlagSchema,
          },
        },
      },
    },
  },
});
