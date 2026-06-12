import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const { config, createHandler } = defineGateway({
  name: "udp",
  environments: ["development", "staging", "production"],
  access: "isolated",
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/udp/consumer-config-secret-arn",
      env: "FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN",
      scope: "environment",
      // TODO: remove transform when field is renamed (`consumerRoleArn` to `roleArn`)
      config: z
        .object({
          region: NonEmptyString,
          apiAccountId: NonEmptyString,
          apiUrl: NonEmptyString,
          apiKey: NonEmptyString,
          consumerRoleArn: NonEmptyString,
          externalId: NonEmptyString.optional(),
        })
        .transform(({ consumerRoleArn, ...rest }) => ({
          ...rest,
          roleArn: consumerRoleArn,
        })),
    },
    cmk: { type: "kms", path: "/udp/cmk-arn" },
    consumerRole: { type: "role", path: "/udp/consumer-role-arn" },
  },
  downstream: {
    type: "remote-api",
    ref: "consumerConfig",
    auth: { type: "sigv4", role: "consumerRole", roleName: "consumer-session" },
  },
  policy: {},
  routes: {
    "POST /v1/users": {
      name: "createUser",
      body: z.object({ userId: NonEmptyString, pushId: NonEmptyString }),
    },
    "GET /v1/notifications": {
      name: "getNotificationPreferences",
      headers: {
        requestingServiceUserId: {
          name: "requesting-service-user-id",
          required: true,
        },
      },
    },
    "POST /v1/notifications": {
      name: "updateNotificationPreferences",
      headers: {
        requestingServiceUserId: {
          name: "requesting-service-user-id",
          required: true,
        },
      },
    },
    "DELETE /v1/notifications": {
      name: "deleteNotificationPreferences",
      headers: {
        requestingServiceUserId: {
          name: "requesting-service-user-id",
          required: true,
        },
      },
    },
    "GET /v1/identity/:serviceName": {
      name: "getIdentityLink",
      headers: {
        userId: { name: "User-Id", required: true },
      },
    },
    "POST /v1/identity/:serviceName/:identifier": {
      name: "createIdentityLink",
    },
    "DELETE /v1/identity/:serviceName/:identifier": {
      name: "deleteIdentityLink",
    },
    "GET /v1/identities/:id": {
      name: "getIdentities",
    },
    "POST /v1/identities/:id": {
      name: "postIdentities",
    },
  },
});
