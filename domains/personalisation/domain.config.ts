import { domain } from "@flex/sdk";

import {
  GetSelectedTopicsResponseSchema,
  GetVisitedPagesResponseSchema,
  LocalAuthorityResponseSchema,
  LocalAuthoritySchema,
  SearchTermSchema,
  UpdateSelectedTopicsRequestSchema,
  UpdateSelectedTopicsResponseSchema,
  UserSearchesSchema,
  UserSearchResponseSchema,
  VisitedPageSchema,
} from "./src/schemas";

export const { config, route, routeContext } = domain({
  name: "personalisation",
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
    udpGetVisitedPages: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/activity/pages",
      response: GetVisitedPagesResponseSchema,
    },
    udpAddVisitedPage: {
      type: "gateway",
      target: "udp",
      route: "POST /v1/activity/pages",
      body: VisitedPageSchema,
    },
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
        DELETE: {
          public: {
            name: "delete-searches",
            resources: ["privateGatewayUrl"],
            integrations: ["udpPostSearches"],
          },
        },
      },
      "/activity/searches/:term": {
        DELETE: {
          public: {
            name: "delete-search",
            resources: ["privateGatewayUrl"],
            integrations: ["udpPostSearches", "udpGetSearches"],
          },
        },
      },
      "/activity/pages": {
        GET: {
          public: {
            name: "get-visited-pages",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetVisitedPages"],
            response: GetVisitedPagesResponseSchema,
          },
        },
        POST: {
          public: {
            name: "add-visited-page",
            resources: ["privateGatewayUrl"],
            integrations: ["udpAddVisitedPage"],
            body: VisitedPageSchema,
          },
        },
      },
      // Not deployed to development, staging or production: UDP has no
      // local-council gateway route yet. To be refactored and completed in
      // FLEX-268 (GET), FLEX-269 (POST) and FLEX-270 (DELETE).
      "/preferences/local-council/:id": {
        POST: {
          private: {
            name: "upsert-local-authority",
            environments: [],
            function: { timeoutSeconds: 30 },
            resources: ["privateGatewayUrl"],
            integrations: ["udpSaveLocalAuthority"],
            body: LocalAuthoritySchema,
          },
        },
        GET: {
          private: {
            name: "get-local-authority",
            environments: [],
            function: { timeoutSeconds: 30 },
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetLocalAuthority"],
            response: LocalAuthorityResponseSchema,
          },
        },
      },
    },
  },
});
