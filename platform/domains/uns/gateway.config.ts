import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import z from "zod";

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
      // TODO: remove transform when field is renamed (`privateApiUrl` to `apiUrl`)
      config: z
        .object({
          apiUrl: NonEmptyString,
          apiKey: NonEmptyString,
          roleArn: NonEmptyString,
          privateApiUrl: NonEmptyString,
          region: NonEmptyString,
        })
        .transform(({ privateApiUrl, ...rest }) => ({
          ...rest,
          apiUrl: privateApiUrl,
        })),
    },
    consumerRole: { type: "role", path: "/uns/consumer-role-arn" },
    encryptionKey: { type: "kms", path: "/flex-secret/encryption-key" },
  },
  downstream: {
    type: "remote-api",
    ref: "consumerConfig",
    auth: {
      type: "sigv4",
      role: "consumerRole",
      roleName: "uns-consumer-session",
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
