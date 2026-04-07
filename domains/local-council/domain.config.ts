import { domain } from "@flex/sdk";

import {
  LocalAuthorityResponseSchema,
  LocalAuthoritySchema,
} from "./src/schemas/local-authority";

export const { config, route, routeContext } = domain({
  name: "local-council",
  common: {
    access: "isolated",
    function: { timeoutSeconds: 30 },
  },
  resources: {
    flexPrivateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
  },
  integrations: {
    udpSaveLocalAuthority: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/local-council/*",
      body: LocalAuthoritySchema,
    },
    udpGetLocalAuthority: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/local-council/*",
      response: LocalAuthorityResponseSchema,
    },
  },
  routes: {
    v1: {
      "/local-council/:id": {
        POST: {
          private: {
            name: "upsert-local-authority",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["udpSaveLocalAuthority"],
            body: LocalAuthoritySchema,
          },
        },
        GET: {
          private: {
            name: "get-local-authority",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["udpGetLocalAuthority"],
            response: LocalAuthorityResponseSchema,
          },
        },
      },
    },
  },
});
