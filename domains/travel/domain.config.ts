import { domain } from "@flex/sdk";
import {
  GetCountriesResponseSchema,
  GetEventsQuerySchema,
  GetEventsResponseSchema,
} from "@flex/travel-service-gateway";

export const { config, route, routeContext } = domain({
  name: "travel",
  environments: ["development", "staging"],
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
    travelGetCountries: {
      type: "gateway",
      target: "travel",
      route: "GET /v1/countries",
      response: GetCountriesResponseSchema,
    },
    travelGetEvents: {
      type: "gateway",
      target: "travel",
      route: "GET /v1/events",
      query: GetEventsQuerySchema,
      response: GetEventsResponseSchema,
    },
  },
  routes: {
    v1: {
      "/countries": {
        GET: {
          public: {
            name: "list-countries",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["travelGetCountries"],
            response: GetCountriesResponseSchema,
          },
        },
      },
      "/events": {
        GET: {
          public: {
            name: "fetch-recent-travel-alerts",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["travelGetEvents"],
            query: GetEventsQuerySchema,
            response: GetEventsResponseSchema,
          },
        },
      },
    },
  },
});

export const listCountriesContext = routeContext<"GET /v1/countries">;
