import { domain } from "@flex/sdk";

import { TopicsRequestSchema, TopicsResponseSchema } from "./src/schemas";

export const { config, route, routeContext } = domain({
  name: "topics",
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
    udpPostTopics: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/topics",
      body: TopicsRequestSchema,
      response: TopicsResponseSchema,
    },
  },
  routes: {
    v1: {
      "/topics": {
        PATCH: {
          public: {
            name: "upsert-topics",
            resources: ["privateGatewayUrl"],
            integrations: ["udpPostTopics"],
            body: TopicsRequestSchema,
          },
        },
      },
    },
  },
});
