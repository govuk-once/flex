import { domain } from "@flex/sdk";

import {
  NewSearch,
  Searches,
} from "./src/schemas";

export const { config, route, routeContext } = domain({
  name: "searches",
  environments: ["development"],
  common: {
    access: "isolated",
    function: { timeoutSeconds: 20 },
  },
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
  },
  integrations: {
    udpPostSearches: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/activity/searches",
      body: Searches,
      response: Searches,
    },
   udpGetSearches: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/activity/searches",
      response: Searches,
    },
  },
  routes: {
    v1: {
      "/activity/searches": {
        PATCH: {
          public: {
            name: "upsert-searches",
            resources: ["privateGatewayUrl"],
            integrations: ["udpPostSearches"],
            body: NewSearch,
          },
        },
        GET: {
          public: {
            name: "get-searches",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetSearches"],
            response: Searches,
          },
        },
      },
    },
  },
});
