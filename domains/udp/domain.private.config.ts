import { defineDomain } from "@flex/sdk";

export const endpoints = defineDomain({
  domain: "udp",
  versions: {
    v1: {
      routes: {
        "/user": {
          PATCH: {
            type: "ISOLATED",
            entry: "handlers/internal/v1/user/patch.ts",
            envEphemeral: {
              FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                "/flex-core/private-gateway/url",
            },
            timeoutSeconds: 10,
            permissions: [
              {
                type: "gateway",
                path: "notifications",
                method: "POST",
              },
            ],
          },
          POST: {
            type: "ISOLATED",
            entry: "handlers/internal/v1/user/post.ts",
            envEphemeral: {
              FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                "/flex-core/private-gateway/url",
            },
            timeoutSeconds: 10,
            permissions: [
              {
                type: "gateway",
                path: "user",
                method: "POST",
              },
            ],
          },
        },
      },
    },
  },
});
