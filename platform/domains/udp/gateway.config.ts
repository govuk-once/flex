import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import z from "zod";

// TODO: verify config against existing SG
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
      config: z.object({
        apiAccountId: NonEmptyString,
        apiKey: NonEmptyString,
        apiUrl: NonEmptyString,
        consumerRoleArn: NonEmptyString,
        region: NonEmptyString,
        externalId: NonEmptyString.optional(),
      }),
    },
    consumerRole: {
      type: "role",
      path: "/udp/consumer-role-arn",
    },
    cmk: {
      type: "kms",
      path: "/udp/cmk-arn",
    },
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
        userId: {
          name: "User-Id",
          required: true,
        },
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
