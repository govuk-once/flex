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
          },
          PATCH: {
            type: "ISOLATED",
            entry: "handlers/public/v1/user/patch.ts",
            kmsKeys: {
              ENCRYPTION_KEY_ARN: "/flex-secret/encryption-key",
            },
          },
        },
      },
    },
  },
});
