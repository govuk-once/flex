import { domain } from "@flex/sdk";

import {
  SearchTermSchema,
  UserSearchesSchema,
  UserSearchResponseSchema,
} from "./src/schemas/search";
import {
  GetSelectedTopicsResponseSchema,
  UpdateSelectedTopicsRequestSchema,
  UpdateSelectedTopicsResponseSchema,
} from "./src/schemas/topic";

export const { config, route, routeContext } = domain({
  name: "app-personalisation",
  environments: ["development", "staging"],
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
      body: UpdateSelectedTopicsRequestSchema,
      response: UpdateSelectedTopicsResponseSchema,
    },
    udpGetTopics: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/topics",
      response: GetSelectedTopicsResponseSchema,
    },
    udpPostSearches: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/activity/searches",
      body: UserSearchesSchema,
      response: UserSearchResponseSchema,
    },
    udpGetSearches: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/activity/searches",
      response: UserSearchesSchema,
    },
  },
  routes: {
    v1: {
      "/preferences/topics": {
        PATCH: {
          public: {
            name: "upsert-topics",
            resources: ["privateGatewayUrl"],
            integrations: ["udpPostTopics"],
            body: UpdateSelectedTopicsRequestSchema,
          },
        },
        GET: {
          public: {
            name: "retrieve-topics",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetTopics"],
            response: GetSelectedTopicsResponseSchema,
          },
        },
      },
      "/activity/searches": {
        PATCH: {
          public: {
            name: "upsert-searches",
            resources: ["privateGatewayUrl"],
            integrations: ["udpPostSearches", "udpGetSearches"],
            body: SearchTermSchema,
          },
        },
        GET: {
          public: {
            name: "retrieve-searches",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetSearches"],
            response: UserSearchesSchema,
          },
        },
      },
    },
  },
});
