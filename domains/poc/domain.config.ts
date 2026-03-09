import { domain, header, integration, resource } from "@flex/sdk";
import {
  createNotificationRequestSchema,
  createNotificationResponseSchema,
  createUserRequestSchema,
  userProfileResponseSchema,
} from "@flex/udp-domain";

const { config, route, routeContext } = domain({
  name: "poc",
  common: {
    function: { timeoutSeconds: 30 },
  },
  resources: {
    encryptionKeyArn: resource.kms("/flex-secret/encryption-key"),
    flexPrivateGatewayUrl: resource.ssm("/flex-core/private-gateway/url", {
      scope: "stage",
    }),
    flexUdpNotificationSecret: resource.secret(
      "/flex-secret/udp/notification-hash-secret",
    ),
  },
  integrations: {
    udpRead: integration.gateway("GET /v1/*", { target: "udp" }),
    udpWrite: integration.gateway("POST /v1/*", { target: "udp" }),
    udpPatchUser: integration.domain("PATCH /v1/user", {
      target: "udp",
      body: createNotificationRequestSchema,
      response: createNotificationResponseSchema,
    }),
  },
  routes: {
    v1: {
      "/poc-user": {
        GET: {
          public: {
            name: "get-user-profile",
            resources: [
              "encryptionKeyArn",
              "flexPrivateGatewayUrl",
              "flexUdpNotificationSecret",
            ],
            integrations: ["udpRead", "udpWrite"],
            response: userProfileResponseSchema,
          },
        },
        POST: {
          private: {
            name: "create-user-profile",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["udpWrite"],
            body: createUserRequestSchema,
          },
        },
        PATCH: {
          public: {
            name: "update-user-preferences",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["udpPatchUser"],
            body: createNotificationRequestSchema,
            response: createNotificationResponseSchema,
          },
          private: {
            name: "sync-user-preferences",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["udpWrite"],
            headers: {
              requestingServiceUserId: header("requesting-service-user-id"),
            },
            body: createNotificationRequestSchema,
          },
        },
      },
    },
  },
});

export const getUserContext = routeContext<"GET /v1/poc-user">;
export const createUserContext = routeContext<"POST /v1/poc-user [private]">;
export const patchUserContext = routeContext<"PATCH /v1/poc-user">;
export const patchUserPrivateContext =
  routeContext<"PATCH /v1/poc-user [private]">;

export { config, route };
