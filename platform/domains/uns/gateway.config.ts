import { defineGateway } from "@flex/sdk";
import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const { config, createHandler } = defineGateway({
  name: "uns",
  environments: ["development", "staging"],
  access: "isolated",
  common: {
    function: { timeoutSeconds: 30 },
  },
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/uns/consumer-config-secret-arn",
      schema: z.object({
        apiKey: NonEmptyString,
        apiUrl: NonEmptyString,
        // roleArn: NonEmptyString, // now defined in config.resources
        privateApiUrl: NonEmptyString, // TODO: assign to `apiUrl` for consistency (always point to apiUrl)
        region: NonEmptyString, // not needed
      }),
    },
    consumerRole: {
      type: "role",
      path: "/uns/consumer-role-arn",
    },
    encryptionKey: {
      type: "kms",
      path: "/flex-secret/encryption-key",
    },
  },
  integration: {
    source: "consumerConfig",
    url: "privateApiUrl",
    auth: {
      headers: { "X-API-KEY": "$resources.consumerConfig.apiKey" },
      signing: { type: "sigv4", role: "consumerRole" },
    },
  },
  routes: {
    v1: {
      "/notifications": {
        GET: {
          operation: "GET /notifications",
          query: z.any() /** z.object({ externalUserID: Uuid }) */,
          transformRequest: {
            query: {
              externalUserID: "$query.externalUserID",
            },
          },
          response: z.any() /** GetNotificationsResponseSchema */,
        },
      },
      "/notifications/:id": {
        GET: {
          operation: "GET /notifications/:id",
          path: z.any() /** z.object({ id: Uuid }) */,
          query: z.any() /** z.object({ externalUserID: Uuid }) */,
          transformRequest: {
            query: {
              externalUserID: "$query.externalUserID",
            },
          },
          response: z.any() /** GetNotificationResponseSchema */,
        },
        DELETE: {
          operation: "DELETE /notifications/:id",
          path: z.any() /** z.object({ id: Uuid }) */,
          query: z.any() /** z.object({ externalUserID: Uuid }) */,
          transformRequest: {
            query: {
              externalUserID: "$query.externalUserID",
            },
          },
        },
      },
      "/notifications/:id/status": {
        PATCH: {
          operation: "PATCH /notifications/:id/status",
          path: z.any() /** z.object({ id: Uuid }) */,
          query: z.any() /** z.object({ externalUserID: Uuid }) */,
          body: z.any() /** NotificationsPatchBodySchema */,
          transformRequest: {
            query: {
              externalUserID: "$query.externalUserID",
            },
          },
        },
      },
    },
  },
});
