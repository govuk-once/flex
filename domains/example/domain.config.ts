import { domain } from "@flex/sdk";
import {
  CreateNotificationPreferencesRequestSchema,
  CreateNotificationPreferencesResponseSchema,
  GetServiceIdentityLinkResponseSchema,
  GetUserPushIdResponseSchema,
  UpdateNotificationPreferencesRequestSchema,
  UpdateNotificationPreferencesResponseSchema,
} from "@flex/udp-domain";

import {
  NotificationsResponseSchema,
  UpdateNotificationPreferencesOutboundResponseWithFeatureFlagSchema,
} from "./src/schemas/notifications";
import {
  CreateTodoRequestSchema,
  CreateTodoResponseSchema,
  GetTodoResponseSchema,
  ListTodosQuerySchema,
  ListTodosResponseSchema,
} from "./src/schemas/todos";

export const { config, route, routeContext } = domain({
  name: "example",
  common: {
    access: "isolated",
    logLevel: "INFO",
    function: {
      timeoutSeconds: 20,
      memorySize: 128,
      environment: {
        key: "value",
      },
    },
    headers: {
      exampleId: { name: "x-example-id", required: false },
    },
  },
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
    encryptionKeyArn: { type: "kms", path: "/flex-secret/encryption-key" },
    udpNotificationSecret: {
      type: "secret",
      path: "/flex-secret/udp/notification-hash-secret",
    },
    privateGatewaysRoot: {
      type: "ssm:runtime",
      path: "/flex/apigw/private/gateways-root",
      scope: "stage",
    },
  },
  featureFlags: {
    enableTodoMetadata: {
      description: "Include metadata in todo responses",
      default: false,
      environments: ["development"],
    },
    newUserProfileEnabled: {
      description: "Enable the new user profile experience",
      default: false,
      environments: ["development", "staging"],
    },
  },
  integrations: {
    unsGetNotifications: {
      type: "gateway",
      target: "uns",
      route: "GET /v1/notifications",
      response: NotificationsResponseSchema,
    },
    createTodo: {
      type: "domain",
      route: "POST /v0/todos",
      body: CreateTodoRequestSchema,
      response: CreateTodoResponseSchema,
    },
    udpGetIdentity: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/identity/*",
    },
    udpCreateNotifications: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/notifications",
      body: CreateNotificationPreferencesRequestSchema,
      response: CreateNotificationPreferencesResponseSchema,
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
      "/todos": {
        GET: {
          public: {
            name: "list-todos",
            query: ListTodosQuerySchema,
            response: ListTodosResponseSchema,
            featureFlags: ["enableTodoMetadata"],
          },
        },
        POST: {
          private: {
            name: "create-todo",
            body: CreateTodoRequestSchema,
            response: CreateTodoResponseSchema,
          },
        },
      },
      "/todos/:id": {
        GET: {
          public: {
            name: "get-todo",
            response: GetTodoResponseSchema,
            featureFlags: ["enableTodoMetadata"],
          },
        },
        DELETE: {
          public: {
            name: "delete-todo",
          },
        },
      },
      "/todos/:id/duplicate": {
        POST: {
          public: {
            name: "duplicate-todo",
            response: CreateTodoResponseSchema,
            resources: ["privateGatewayUrl"],
            integrations: ["createTodo"],
          },
        },
      },
      "/headers": {
        GET: {
          public: {
            name: "get-headers",
            headers: {
              requestId: { name: "x-request-id", required: true },
              correlationId: { name: "x-correlation-id", required: false },
            },
          },
        },
      },
      "/resources": {
        GET: {
          public: {
            name: "get-resources",
            resources: [
              "privateGatewayUrl",
              "encryptionKeyArn",
              "udpNotificationSecret",
            ],
          },
        },
      },
      "/resources/runtime": {
        GET: {
          public: {
            name: "get-runtime-resource",
            resources: ["privateGatewaysRoot"],
          },
        },
      },
      "/identity/:service": {
        GET: {
          public: {
            name: "get-identity-link",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetIdentity"],
          },
          private: {
            name: "get-identity-link",
            response: GetServiceIdentityLinkResponseSchema,
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetIdentity"],
            headers: {
              userId: { name: "User-Id", required: true },
            },
          },
        },
      },
      "/notifications": {
        PATCH: {
          public: {
            name: "update-notifications",
            body: UpdateNotificationPreferencesRequestSchema,
            response: UpdateNotificationPreferencesResponseSchema,
            resources: [
              "encryptionKeyArn",
              "privateGatewayUrl",
              "udpNotificationSecret",
            ],
            integrations: ["udpCreateNotifications"],
            function: { timeoutSeconds: 30 },
          },
        },
      },
      "/users/notifications": {
        PATCH: {
          public: {
            name: "update-user-notification-preferences",
            resources: [
              "privateGatewayUrl",
              "encryptionKeyArn",
              "udpNotificationSecret",
            ],
            integrations: ["udpCreateNotifications", "udpGetPushId"],
            featureFlags: ["newUserProfileEnabled"],
            function: { timeoutSeconds: 20 },
            body: UpdateNotificationPreferencesRequestSchema,
            response:
              UpdateNotificationPreferencesOutboundResponseWithFeatureFlagSchema,
          },
        },
        GET: {
          public: {
            name: "get-user-notifications",
            resources: [
              "privateGatewayUrl",
              "encryptionKeyArn",
              "udpNotificationSecret",
            ],
            integrations: ["unsGetNotifications", "udpGetPushId"],
            featureFlags: ["newUserProfileEnabled"],
            function: { timeoutSeconds: 20 },
            response: NotificationsResponseSchema,
          },
        },
      },
    },
  },
});
