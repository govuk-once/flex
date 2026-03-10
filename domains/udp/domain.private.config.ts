import { defineDomain } from "@flex/sdk";

export const endpoints = defineDomain({
  domain: "udp",
  versions: {
    v1: {
      routes: {
        "/users": {
          POST: {
            type: "ISOLATED",
            entry: "handlers/internal/v1/user/post.ts",
            envEphemeral: {
              FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                "/flex/apigw/private/gateway-url",
            },
            timeoutSeconds: 20,
            permissions: [
              {
                type: "gateway",
                target: "udp",
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
