import { defineGateway } from "@flex/sdk";
import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const { config, createHandler } = defineGateway({
  name: "udp",
  environments: ["development", "staging", "production"],
  access: "isolated",
  common: {
    function: { timeoutSeconds: 30 },
  },
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/udp/consumer-config-secret-arn",
      schema: z.object({
        apiAccountId: NonEmptyString, // TODO: Why does the existing code never read this?
        apiKey: NonEmptyString,
        apiUrl: NonEmptyString,
        region: NonEmptyString, // TODO: Is this needed? Should we promote "region" to the config?
        // consumerRoleArn: NonEmptyString, // TODO: entry in config.resources to replace this
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
  integration: {
    source: "consumerConfig",
    auth: {
      headers: { "x-api-key": "$resources.consumerConfig.apiKey" },
      signing: { type: "sigv4", role: "consumerRole" },
    },
  },
  routes: {
    v1: {
      "/users": {
        POST: {
          operation: "POST /v1/user",
          body: z.any() /** InboundCreateUserSchema */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              pushId: "$body.pushId",
              appId: "$body.userId",
            },
          },
        },
      },
      "/notifications": {
        GET: {
          operation: "GET /v1/notifications",
          headers: {
            requestingServiceUserId: {
              name: "requesting-service-user-id",
              required: true,
            },
          },
          transformRequest: {
            headers: {
              "requesting-service-user-id": "$headers.requestingServiceUserId",
              "requesting-service": "app",
            },
          },
          transformResponse: {
            body: "$body.data",
          },
          integrationResponse:
            z.any() /** z.object({ data: NotificationsResponseSchema }) */,
          response: z.any() /** NotificationsResponseSchema */,
        },
        POST: {
          operation: "POST /v1/notifications",
          body: z.any() /** InboundCreateOrUpdateNotificationsSchema */,
          headers: {
            requestingServiceUserId: {
              name: "requesting-service-user-id",
              required: true,
            },
          },
          transformRequest: {
            headers: {
              "requesting-service-user-id": "$headers.requestingServiceUserId",
              "requesting-service": "app",
            },
          },
          transformResponse: {
            body: "$body.data",
          },
          integrationResponse:
            z.any() /** z.object({ data: CreateOrUpdateNotificationsResponseSchema }) */,
          response: z.any() /** CreateOrUpdateNotificationsResponseSchema */,
        },
        DELETE: {
          operation: "DELETE /v1/notifications",
          headers: {
            requestingServiceUserId: {
              name: "requesting-service-user-id",
              required: true,
            },
          },
          transformRequest: {
            headers: {
              "requesting-service-user-id": "$headers.requestingServiceUserId",
              "requesting-service": "app",
            },
          },
        },
      },
      "/identity/:serviceName": {
        GET: {
          operation: "GET /v1/identity/exchange",
          path: z.any() /** z.object({ serviceName: NonEmptyString }) */,
          headers: {
            userId: { name: "User-Id", required: true },
          },
          transformRequest: {
            headers: {
              "requesting-service-user-id": "$headers.userId",
              "requesting-service": "app",
            },
            query: {
              requiredService: "$path.serviceName",
            },
          },
          response: z.any() /** GetServiceIdentityLinkResponseSchema */,
        },
      },
      "/identity/:serviceName/:identifier": {
        POST: {
          operation: "POST /v1/identity/:serviceName/:identifier",
          path: z.any() /** z.object({ serviceName: NonEmptyString, identifier: NonEmptyString }) */,
          body: z.any() /** CreateIdentityRequestBodySchema */,
        },
        DELETE: {
          operation: "DELETE /v1/identity/:serviceName/:identifier",
          path: z.any() /** z.object({ serviceName: NonEmptyString, identifier: NonEmptyString }) */,
        },
      },
      "/identities/:id": {
        GET: {
          operation: "GET /v1/identities",
          path: z.any() /** z.object({ id: NonEmptyString }) */,
          transformRequest: {
            headers: {
              "requesting-service-user-id": "$path.id",
              "requesting-service": "app",
            },
          },
          response: z.any() /** GetIdentitiesResponseSchema */,
        },
        POST: {
          operation: "POST /v1/identities",
          path: z.any() /** z.object({ id: NonEmptyString }) */,
          body: z.any() /** PostIdentitiesBodySchema */,
          transformRequest: {
            headers: {
              "requesting-service-user-id": "$path.id",
              "requesting-service": "app",
            },
          },
        },
      },
    },
  },
});
