import { domain } from "@flex/sdk";
import { GetCountriesResponseSchema } from "@flex/travel-service-gateway";

export const { config, route, routeContext } = domain({
  name: "udp",
  environments: ["development", "staging", "production"],
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
    travelGetCountries: {
      type: "gateway",
      target: "travel",
      route: "GET /v1/countries",
      response: GetCountriesResponseSchema,
    },
  },
  routes: {
    v1: {
      "/countries": {
        GET: {
          public: {
            name: "get-countries-list",
            resources: ["privateGatewayUrl"],
            integrations: ["travelGetCountries"],
            response: GetCountriesResponseSchema,
          },
        },
      },
    },
  },
});
