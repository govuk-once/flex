import { domain } from "@flex/sdk";
import { GetServiceIdentityLinkResponseSchema } from "@flex/udp-domain";

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
    flexPrivateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
    encryptionKeyArn: { type: "kms", path: "/flex-secret/encryption-key" },
  },
  integrations: {
    dvlaTestNotification: {
      type: "gateway",
      target: "dvla",
      route: "POST /v1/test-notification/*",
    },
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
    udpGetLinkingId: {
      type: "domain",
      target: "udp",
      route: "GET /v1/identity/*",
      response: GetServiceIdentityLinkResponseSchema,
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
              "udpGetLinkingId",
            ],
            response: viewDriverResponseSchema,
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
          },
        },
      },
      "/test-notification": {
        POST: {
          public: {
            name: "post-test-notification",
            integrations: [
              "dvlaAuthenticate",
              "dvlaTestNotification",
              "udpGetLinkingId",
            ],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
          },
        },
      },
    },
  },
});
