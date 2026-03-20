import { domain } from "@flex/sdk";

import { authenticateResponseSchema } from "./src/schemas/authenticate";
import { getCustomerResponseSchema } from "./src/schemas/customer";
import { viewDriverResponseSchema } from "./src/schemas/driversLicence";

export const { config, route, routeContext } = domain({
  name: "dvla",
  common: {
    access: "private",
    function: { timeoutSeconds: 30 },
  },
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
    encryptionKey: { type: "kms", path: "/flex-secret/encryption-key" },
  },
  integrations: {
    dvlaRetrieveCustomer: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/customer/*",
      response: getCustomerResponseSchema,
    },
    dvlaRetrieveLicence: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/licence/*",
      response: viewDriverResponseSchema,
    },
    dvlaAuthenticate: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/authenticate",
      response: authenticateResponseSchema,
    },
  },
  routes: {
    v1: {
      "/driving-licence": {
        GET: {
          public: {
            name: "get-users-drivers-licence",
            integrations: [
              "dvlaAuthenticate",
              "dvlaRetrieveLicence",
              "dvlaRetrieveCustomer",
            ],
            response: viewDriverResponseSchema,
          },
        },
      },
    },
  },
});
