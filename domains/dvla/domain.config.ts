import { domain } from "@flex/sdk";
import { viewDriverResponseSchema } from "@schemas/driversLicence";

export const { config, route, routeContext } = domain({
  name: "dvla",
  integrations: {
    dvlaGet: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/*",
      response: viewDriverResponseSchema,
    },
  },
  common: {
    access: "private",
    function: { timeoutSeconds: 30 },
  },
  routes: {
    v1: {
      "/driving-licence": {
        GET: {
          public: {
            name: "get-users-drivers-licence",
            integrations: ["dvlaGet"],
            response: viewDriverResponseSchema,
          },
        },
      },
    },
  },
});
