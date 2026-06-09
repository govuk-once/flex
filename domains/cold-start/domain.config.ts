import { domain } from "@flex/sdk";

import { cascadeQuerySchema } from "./src/schemas/cascade";

export const { config, route, routeContext } = domain({
  name: "cold-start",
  environments: ["development"],
  common: {
    access: "private",
    function: { memorySize: 128, timeoutSeconds: 30 },
  },
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
  },
  integrations: {
    cascadeNext: { type: "domain", route: "GET /v1/cascade" },
  },
  routes: {
    v1: {
      "/cascade": {
        GET: {
          public: {
            name: "cascade",
            query: cascadeQuerySchema,
            integrations: ["cascadeNext"],
            resources: ["privateGatewayUrl"],
          },
          private: {
            name: "cascade",
            query: cascadeQuerySchema,
            integrations: ["cascadeNext"],
            resources: ["privateGatewayUrl"],
          },
        },
      },
    },
  },
});
