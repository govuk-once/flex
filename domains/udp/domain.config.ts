import { defineDomain } from "@flex/sdk";

export const endpoints = defineDomain({
  domain: "udp",
  versions: {
    v1: {
      routes: {
        "/user": {
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
                "/flex-core/private-gateway/url",
            },
            timeoutSeconds: 15,
            permissions: [
              {
                type: "domain",
                path: "/v1/user",
                method: "POST",
              },
              {
                type: "gateway",
                path: "",
                method: "GET",
              },
            ],
          },
          PATCH: {
            type: "ISOLATED",
            entry: "handlers/public/v1/user/patch.ts",
            envEphemeral: {
              FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                "/flex-core/private-gateway/url",
            },
            timeoutSeconds: 10,
            permissions: [
              {
                type: "domain",
                path: "/v1/user",
                method: "PATCH",
              },
            ],
          },
        },
      },
    },
  },
});
