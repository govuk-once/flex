import { defineDomain } from "@flex/sdk";

export const endpoints = defineDomain({
  domain: "udp",
  public: {
    versions: {
      v1: {
        routes: {
          "/user": {
            GET: {
              type: "ISOLATED",
              entry: "handlers/public/v1/user/getUserInfoCanned.ts",
              envSecret: {
                FLEX_UDP_NOTIFICATION_SECRET:
                  "/flex-secret/udp/notification-hash-secret",
              },
              env: {
                FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                  "/flex-core/private-gateway/url",
              },
              kmsKeys: {
                ENCRYPTION_KEY_ARN: "/flex-secret/encryption-key",
              },
              permissions: [
                {
                  type: "domain",
                  path: "/v1/user",
                  method: "POST",
                },
                {
                  type: "gateway",
                  path: "/udp",
                  method: "GET",
                },
              ],
            },
            PATCH: {
              type: "ISOLATED",
              entry: "handlers/public/v1/user/patch.ts",
              kmsKeys: {
                ENCRYPTION_KEY_ARN: "/flex-secret/encryption-key",
              },
            },
          },
          "/user/info": {
            GET: {
              type: "ISOLATED",
              entry: "handlers/public/v1/user/getUserInfo.ts",
              envSecret: {
                FLEX_UDP_NOTIFICATION_SECRET:
                  "/flex-secret/udp/notification-hash-secret",
              },
              env: {
                FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                  "/flex-core/private-gateway/url",
              },
              kmsKeys: {
                ENCRYPTION_KEY_ARN: "/flex-secret/encryption-key",
              },
              permissions: [
                {
                  type: "domain",
                  path: "/v1/user",
                  method: "POST",
                },
                {
                  type: "gateway",
                  path: "/udp",
                  method: "GET",
                },
              ],
            },
          },
        },
      },
    },
  },
  private: {
    versions: {
      v1: {
        routes: {
          "/user": {
            POST: {
              type: "ISOLATED",
              entry: "handlers/private/v1/user/post.ts",
              env: {
                FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                  "/flex-core/private-gateway/url",
              },
              permissions: [
                {
                  type: "gateway",
                  path: "",
                  method: "POST",
                },
              ],
            },
          },
        },
      },
    },
  },
});
