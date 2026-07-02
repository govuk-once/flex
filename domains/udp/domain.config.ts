import { domain } from "@flex/sdk";

import {
  CreateNotificationPreferencesRequestSchema,
  CreateNotificationPreferencesResponseSchema,
  CreateUserRequestSchema,
  GetIdentitiesGWResponseSchema,
  GetIdentitiesResponseSchema,
  GetNotificationPreferencesResponseSchema,
  GetServiceIdentityLinkResponseSchema,
  GetUserPushIdResponseSchema,
  GetUserResponseSchema,
  JwkSetSchema,
  UpdateNotificationPreferencesOutboundResponseSchema,
  UpdateNotificationPreferencesRequestSchema,
} from "./src/schemas";

export const { config, route, routeContext } = domain({
  name: "udp",
  environments: ["development", "staging", "production"],
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
    decyrptionKey: {
      type: "kms",
      path: "/third-party-encryption-key",
      scope: "stage",
    },
    udpNotificationSecret: {
      type: "secret",
      path: "/flex-secret/udp/notification-hash-secret",
    },
  },
  integrations: {
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
    udpGetIdentities: {
      type: "gateway",
      route: "GET /v1/identities/*",
      response: GetIdentitiesGWResponseSchema,
    },
    udpPostIdentities: {
      type: "gateway",
      route: "POST /v1/identities/*",
    },
    dvlaGetWellKnownJwk: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/well-known-jwks",
      response: JwkSetSchema,
    },
    dvlaUnlinkUser: {
      type: "domain",
      target: "dvla",
      route: "POST /v1/unlink/*",
    },
  },
  routes: {
    v1: {
      "/identity": {
        GET: {
          public: {
            name: "get-users-service-identities",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetIdentities"],
            response: GetIdentitiesResponseSchema,
          },
        },
      },
      "/identity/:service": {
        GET: {
          public: {
            name: "get-service-identity",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetIdentity"],
          },
          private: {
            name: "get-service-identity",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetIdentity"],
            headers: {
              userId: {
                name: "User-Id",
                required: true,
              },
            },
            response: GetServiceIdentityLinkResponseSchema,
          },
        },
        DELETE: {
          public: {
            name: "delete-service-identity",
            resources: ["privateGatewayUrl"],
            integrations: [
              "udpDeleteIdentity",
              "udpGetIdentity",
              "dvlaUnlinkUser",
              "udpGetIdentities",
              "udpPostIdentities",
            ],
          },
        },
        POST: {
          public: {
            name: "create-service-identity-link",
            resources: ["privateGatewayUrl", "decyrptionKey"],
            integrations: [
              "udpCreateIdentity",
              "udpDeleteIdentity",
              "udpGetIdentity",
              "udpGetIdentities",
              "udpPostIdentities",
              "dvlaGetWellKnownJwk",
            ],
            headers: {
              linkingToken: {
                name: "x-linking-token",
                required: true,
              },
            },
          },
        },
      },
      "/users/me": {
        GET: {
          public: {
            name: "upsert-user",
            resources: [
              "privateGatewayUrl",
              "encryptionKey",
              "udpNotificationSecret",
            ],
            integrations: [
              "udpCreateUser",
              "udpCreateNotificationPreferences",
              "udpGetNotificationPreferences",
            ],
            function: { timeoutSeconds: 25 },
            response: GetUserResponseSchema,
          },
        },
      },
      "/users/push-id": {
        GET: {
          private: {
            name: "get-user-notification-push-id",
            resources: [
              "udpNotificationSecret",
              "encryptionKey",
              "privateGatewayUrl",
            ],
            headers: {
              userId: {
                name: "User-Id",
                required: true,
              },
            },
            response: GetUserPushIdResponseSchema,
          },
        },
      },
      "/users/me/notifications": {
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
