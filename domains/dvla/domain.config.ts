import {
  RetrieveCustomerSummaryByLinkingIdResponse,
  RetrieveDriverSummaryByLinkingIdResponse,
} from "@flex/dvla-service-gateway";
import { domain } from "@flex/sdk";
import { GetServiceIdentityLinkResponseSchema } from "@flex/udp-domain";

import { authenticateResponseSchema } from "./src/schemas/authenticate";
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
    dvlaCustomerSummary: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/customer-summary/*",
      response: RetrieveCustomerSummaryByLinkingIdResponse,
    },
    dvlaDriverSummary: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/driver-summary/*",
      response: RetrieveDriverSummaryByLinkingIdResponse,
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
              "dvlaCustomerSummary",
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
      "/customer-summary": {
        GET: {
          public: {
            name: "get-customer-summary",
            integrations: [
              "dvlaAuthenticate",
              "dvlaCustomerSummary",
              "udpGetLinkingId",
            ],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
          },
        },
      },
      "/driver-summary": {
        GET: {
          public: {
            name: "get-driver-summary",
            integrations: [
              "dvlaAuthenticate",
              "dvlaDriverSummary",
              "udpGetLinkingId",
            ],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
          },
        },
      },
    },
  },
});
