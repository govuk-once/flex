import { domain } from "@flex/sdk";

import { SessionSchema, VehicleMotSchema } from "./src/schemas";

export const { config, route, routeContext } = domain({
  name: "driving",
  environments: ["development", "staging"],
  common: {
    access: "private",
    function: { timeoutSeconds: 30 },
  },
  resources: {
    flexPrivateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
    encryptionKeyArn: { type: "kms", path: "/flex-secret/encryption-key" },
  },
  integrations: {
    dvsaAuthenticate: {
      type: "gateway",
      target: "dvsa",
      route: "GET /v1/authenticate",
      response: SessionSchema,
    },
    dvsaVehicleMot: {
      type: "gateway",
      target: "dvsa",
      route: "GET /v1/vehicle/mot/*",
      response: VehicleMotSchema,
    },
  },
  routes: {
    v1: {
      "/vehicle/mot/:reg": {
        GET: {
          public: {
            name: "get-vehicle-mot",
            integrations: ["dvsaAuthenticate", "dvsaVehicleMot"],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
            response: VehicleMotSchema,
          },
        },
      },
    },
  },
});
