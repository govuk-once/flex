import { defineDomain } from "@flex/sdk";

export const endpoints = defineDomain({
  domain: "hello",
  public: {
    versions: {
      v1: {
        routes: {
          "/hello-public": {
            GET: {
              entry: "handlers/v1/hello-public/get.ts",
              type: "PUBLIC",
            },
          },
          "/hello-private": {
            GET: {
              entry: "handlers/v1/hello-private/get.ts",
              type: "PRIVATE",
            },
          },
          "/hello-isolated": {
            GET: {
              entry: "handlers/v1/hello-isolated/get.ts",
              type: "ISOLATED",
            },
          },
          "/hello-call-internal": {
            GET: {
              entry: "handlers/v1/hello-call-internal/get.ts",
              type: "ISOLATED",
              env: {
                FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME:
                  "/flex-core/private-gateway/url",
              },
              // Intentionally no permissions - demonstrates private API gateway blocks access
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
          "/hello-internal": {
            GET: {
              entry: "handlers/v1/hello-internal/get.ts",
              type: "ISOLATED",
            },
          },
        },
      },
    },
  },
});
