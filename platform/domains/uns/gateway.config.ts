import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import z from "zod";

// TODO: verify config against existing SG
export const { config, createHandler } = defineGateway({
  name: "uns",
  environments: ["development", "staging"],
  access: "isolated",
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/uns/consumer-config-secret-arn",
      env: "FLEX_UNS_CONSUMER_CONFIG_SECRET_ARN",
      scope: "environment",
      config: z.object({
        apiKey: NonEmptyString,
        apiUrl: NonEmptyString,
        privateApiUrl: NonEmptyString,
        region: NonEmptyString,
        roleArn: NonEmptyString,
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
  policy: {},
  routes: {
    "GET /v1/notifications": {
      name: "getNotifications",
      query: z.object({ externalUserID: NonEmptyString }),
    },
    "GET /v1/notifications/:id": {
      name: "getNotificationById",
      query: z.object({ externalUserID: NonEmptyString }),
    },
    "DELETE /v1/notifications/:id": {
      name: "deleteNotificationById",
      query: z.object({ externalUserID: NonEmptyString }),
    },
    "PATCH /v1/notifications/:id/status": {
      name: "patchNotificationById",
      query: z.object({ externalUserID: NonEmptyString }),
    },
  },
});
