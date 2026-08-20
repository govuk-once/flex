import { domain } from "@flex/sdk";
import { CountriesResponseSchema } from "@flex/travel-service-gateway";

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
    },
  },
});

export const listCountriesContext = routeContext<"GET /v1/countries">;
