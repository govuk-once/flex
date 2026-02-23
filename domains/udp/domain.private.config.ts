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
            permissions: [
              {
                type: "gateway",
                path: "user",
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
