import { defineDomain } from "@flex/sdk";

export const endpoints = defineDomain({
  domain: "udp",
  versions: {
    v1: {
      routes: {
        "/identity/{serviceName}/{identifier}": {
          POST: {
            type: "ISOLATED",
            entry: "handlers/public/v1/identity/post.ts",
            envEphemeral: {
              FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                "/flex/apigw/private/gateway-url",
            },
            timeoutSeconds: 20,
            permissions: [
              {
                type: "gateway",
                target: "udp",
                path: "",
                method: "POST",
              },
            ],
          },
        },
        "/users": {
          GET: {
            type: "ISOLATED",
            entry: "handlers/public/v1/user/get.ts",
            envSecret: {
              FLEX_UDP_NOTIFICATION_SECRET:
                "/flex-secret/udp/notification-hash-secret",
            },
            kmsKeys: {
              ENCRYPTION_KEY_ARN: "/flex-secret/encryption-key",
            },
            envEphemeral: {
              FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                "/flex/apigw/private/gateway-url",
            },
            timeoutSeconds: 25,
            permissions: [
              {
                type: "domain",
                target: "udp",
                path: "/v1/notifications",
                method: "POST",
              },
              {
                type: "domain",
                target: "udp",
                path: "/v1/notifications",
                method: "GET",
              },
              {
                type: "gateway",
                target: "udp",
                path: "",
                method: "GET",
              },
            ],
          },
        },
        "/users/notifications": {
          PATCH: {
            type: "ISOLATED",
            entry: "handlers/public/v1/user/patch.ts",
            envSecret: {
              FLEX_UDP_NOTIFICATION_SECRET:
                "/flex-secret/udp/notification-hash-secret",
            },
            kmsKeys: {
              ENCRYPTION_KEY_ARN: "/flex-secret/encryption-key",
            },
            envEphemeral: {
              FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                "/flex/apigw/private/gateway-url",
            },
            timeoutSeconds: 20,
            permissions: [
              {
                type: "domain",
                target: "udp",
                path: "/v1/notifications",
                method: "PATCH",
              },
            ],
          },
        },
      },
    },
  },
});
