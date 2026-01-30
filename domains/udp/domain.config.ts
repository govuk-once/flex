import { defineDomain } from "@flex/config/domain";

export const endpoints = defineDomain({
  domain: "udp",
  versions: {
    v1: {
      routes: {
        "/user": {
          GET: {
            type: "ISOLATED",
            entry: "handlers/user/get.ts",
            envSecret: {
              FLEX_UDP_NOTIFICATION_SECRET:
                "/flex-secret/udp/notification-hash-secret",
            },
          },
          PATCH: {
            type: "ISOLATED",
            entry: "handlers/user/patch.ts",
            kmsKeys: {
              ENCRYPTION_KEY_ARN: "/flex-secret/encryption-key",
            },
          },
        },
      },
    },
  },
});
