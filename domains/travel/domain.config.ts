import { domain } from "@flex/sdk";
import {
  CountriesResponseSchema,
  EventsQuerySchema,
  EventsResponseSchema,
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
      response: CountriesResponseSchema,
    },
    travelGetEvents: {
      type: "gateway",
      target: "travel",
      route: "GET /v1/events",
      query: EventsQuerySchema,
      response: EventsResponseSchema,
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
            response: CountriesResponseSchema,
          },
        },
      },
      "/events": {
        GET: {
          public: {
            name: "fetch-recent-travel-alerts",
            resources: ["flexPrivateGatewayUrl"],
            integrations: ["travelGetEvents"],
            query: EventsQuerySchema,
            response: EventsResponseSchema,
          },
        },
      },
    },
  },
});

export const listCountriesContext = routeContext<"GET /v1/countries">;
