import { domain, header, integration, resource } from "@flex/sdk";

import {
  CreateUserRequestSchema,
  UserPreferencesRequestSchema,
  UserPreferencesResponseSchema,
  UserProfileResponseSchema,
} from "./src/handlers/v1/user/schema";

export const { config, route, routeContext } = domain({
  name: "poc",
  common: {
    function: { timeoutSeconds: 30 },
  },
  resources: {
    encryptionKeyArn: resource.kms("/flex-secret/encryption-key"),
    flexPrivateGatewayUrl: resource.ssm("/flex-core/private-gateway/url", {
      resolution: "deferred",
    }),
    flexUdpNotificationSecret: resource.secret(
      "/flex-secret/udp/notification-hash-secret",
    ),
  },
  integrations: {
    udpRead: integration.gateway("GET /v1/*"),
    udpWrite: integration.gateway("POST /v1/*"),
    udpPatchUser: integration.domain("PATCH /v1/user", {
      body: UserPreferencesRequestSchema,
      response: UserPreferencesResponseSchema,
    }),
  },
  routes: {
    v1: {
      "/user": {
        GET: {
          public: {
            name: "get-user-profile",
            resources: [
              "encryptionKeyArn",
              "flexPrivateGatewayUrl",
              "flexUdpNotificationSecret",
            ],
            integrations: ["udpRead", "udpWrite"],
            response: UserProfileResponseSchema,
          },
        },
        POST: {
          private: {
            name: "create-user-profile",
            integrations: ["udpWrite"],
            body: CreateUserRequestSchema,
          },
        },
        PATCH: {
          public: {
            name: "update-user-preferences",
            integrations: ["udpPatchUser"],
            body: UserPreferencesRequestSchema,
            response: UserPreferencesResponseSchema,
          },
          private: {
            name: "sync-user-preferences",
            integrations: ["udpWrite"],
            headers: {
              requestingServiceUserId: header("requesting-service-user-id"),
            },
            body: UserPreferencesRequestSchema,
          },
        },
      },
    },
  },
});
