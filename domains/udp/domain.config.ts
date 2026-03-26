import { domain } from "@flex/sdk";

import {
  CreateNotificationPreferencesRequestSchema,
  CreateNotificationPreferencesResponseSchema,
  CreateUserRequestSchema,
  GetNotificationPreferencesResponseSchema,
  GetUserResponseSchema,
  UpdateNotificationPreferencesOutboundResponseSchema,
  UpdateNotificationPreferencesRequestSchema,
} from "./src/schemas";

export const { config, route, routeContext } = domain({
  name: "udp",
  common: {
    access: "isolated",
    function: { timeoutSeconds: 20 },
  },
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
    encryptionKey: { type: "kms", path: "/flex-secret/encryption-key" },
    udpNotificationSecret: {
      type: "secret",
      path: "/flex-secret/udp/notification-hash-secret",
    },
  },
  integrations: {
    createUser: {
      type: "domain",
      route: "POST /v1/users",
      body: CreateUserRequestSchema,
    },
    udpGetIdentity: { type: "gateway", route: "GET /v1/identity/*" },
    udpCreateIdentity: { type: "gateway", route: "POST /v1/identity/*" },
    udpDeleteIdentity: { type: "gateway", route: "DELETE /v1/identity/*" },
    udpGetNotificationPreferences: {
      type: "gateway",
      route: "GET /v1/notifications",
      response: GetNotificationPreferencesResponseSchema,
    },
    udpCreateNotificationPreferences: {
      type: "gateway",
      route: "POST /v1/notifications",
      body: CreateNotificationPreferencesRequestSchema,
      response: CreateNotificationPreferencesResponseSchema,
    },
    udpCreateUser: {
      type: "gateway",
      route: "POST /v1/users",
      body: CreateUserRequestSchema,
    },
  },
  routes: {
    v1: {
      "/identity/:service": {
        GET: {
          public: {
            name: "get-service-identity",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetIdentity"],
          },
        },
        DELETE: {
          public: {
            name: "delete-service-identity",
            resources: ["privateGatewayUrl"],
            integrations: ["udpDeleteIdentity", "udpGetIdentity"],
          },
        },
      },
      "/identity/:service/:id": {
        POST: {
          public: {
            name: "create-service-identity-link",
            resources: ["privateGatewayUrl"],
            integrations: [
              "udpCreateIdentity",
              "udpDeleteIdentity",
              "udpGetIdentity",
            ],
          },
        },
      },
      "/users": {
        GET: {
          public: {
            name: "get-user-notification-preferences",
            resources: [
              "privateGatewayUrl",
              "encryptionKey",
              "udpNotificationSecret",
            ],
            integrations: [
              "createUser",
              "udpCreateNotificationPreferences",
              "udpGetNotificationPreferences",
            ],
            function: { timeoutSeconds: 25 },
            response: GetUserResponseSchema,
          },
        },
        POST: {
          private: {
            name: "create-user",
            resources: ["privateGatewayUrl"],
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
              "privateGatewayUrl",
              "encryptionKey",
              "udpNotificationSecret",
            ],
            integrations: ["udpCreateNotificationPreferences"],
            body: UpdateNotificationPreferencesRequestSchema,
            response: UpdateNotificationPreferencesOutboundResponseSchema,
          },
        },
      },
    },
  },
});
