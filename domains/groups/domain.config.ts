import { domain } from "@flex/sdk";
import { GetUserPushIdResponseSchema } from "@flex/udp-domain";

import {
  GroupsRequestSchema,
  GroupsResponseSchema,
  UnsGroupsRequestSchema,
  UnsGroupsResponseSchema,
} from "./src/schemas/group";

export const { config, route } = domain({
  name: "groups",
  environments: ["development", "staging", "production"],
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
    udpGetPushId: {
      type: "domain",
      target: "udp",
      route: "GET /v1/users/push-id",
      response: GetUserPushIdResponseSchema,
    },
    unsGetGroups: {
      type: "gateway",
      target: "uns",
      route: "GET /v1/groups",
      response: UnsGroupsResponseSchema,
    },
    unsPostGroups: {
      type: "gateway",
      target: "uns",
      route: "POST /v1/groups",
      body: UnsGroupsRequestSchema,
      response: UnsGroupsResponseSchema,
    },
  },
  routes: {
    v1: {
      "/groups": {
        GET: {
          public: {
            name: "get-groups",
            response: GroupsResponseSchema,
            resources: [
              "udpNotificationSecret",
              "encryptionKey",
              "privateGatewayUrl",
            ],
            integrations: ["unsGetGroups", "udpGetPushId"],
          },
        },
        POST: {
          public: {
            name: "post-groups",
            response: GroupsResponseSchema,
            body: GroupsRequestSchema,
            resources: [
              "udpNotificationSecret",
              "encryptionKey",
              "privateGatewayUrl",
            ],
            integrations: ["unsPostGroups", "udpGetPushId"],
          },
        },
      },
    },
  },
});
