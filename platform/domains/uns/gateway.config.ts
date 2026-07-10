import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { NotificationPatchSchema } from "./src/schemas/domain/notification";

export const { config, createHandler } = defineGateway({
  name: "uns",
  environments: ["development", "staging"],
  access: "isolated",
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/uns/consumer-config-secret",
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
      path: "/uns/customer-role",
    },
    encryptionKey: {
      type: "kms",
      path: "/uns/cmk-arn",
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
    "PATCH /v1/notifications/:id/status": {
      name: "patchNotificationById",
      query: z.object({ externalUserID: NonEmptyString }),
      body: NotificationPatchSchema,
    },
    "DELETE /v1/notifications/:id": {
      name: "deleteNotificationById",
      query: z.object({ externalUserID: NonEmptyString }),
    },
  },
});
