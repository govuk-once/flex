import {
  authenticateResponseSchema,
  customerDriversLicenceSchema,
  customerVehicleDetailsSchema,
  customerVehiclesResponseSchema,
  SingleShareCodeResponseSchema,
  SingleShareCodeResponseSchemaWithoutIdSchema,
  vehicleEnquiryResponseSchema,
} from "@flex/dvla-service-gateway";
import { domain } from "@flex/sdk";
import { GetServiceIdentityLinkResponseSchema } from "@flex/udp-domain";

export const { config, route, routeContext } = domain({
  name: "dvla",
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
    dvlaUnlinkUser: {
      type: "gateway",
      target: "dvla",
      route: "POST /v1/unlink-user/*",
    },
    dvlaTestNotification: {
      type: "gateway",
      target: "dvla",
      route: "POST /v1/test-notification/*",
    },
    dvlaAuthenticate: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/authenticate",
      response: authenticateResponseSchema,
    },
    dvlaVehicleEnquiry: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/vehicle-enquiry/*",
      response: vehicleEnquiryResponseSchema,
    },
    udpGetLinkingId: {
      type: "domain",
      target: "udp",
      route: "GET /v1/identity/*",
      response: GetServiceIdentityLinkResponseSchema,
    },
    dvlaPostShareCode: {
      type: "gateway",
      target: "dvla",
      route: "POST /v1/share-code",
      response: SingleShareCodeResponseSchema,
    },
    dvlaCancelShareCode: {
      type: "gateway",
      target: "dvla",
      route: "POST /v1/share-code/*",
      response: SingleShareCodeResponseSchema,
    },
    dvlaGetCustomerVehicle: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/customer/vehicle/*",
      response: customerVehicleDetailsSchema,
    },
    dvlaGetCustomerVehicles: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/customer/vehicles",
      response: customerVehiclesResponseSchema,
    },
    dvlaGetCustomerLicence: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/customer/licence",
      response: customerDriversLicenceSchema,
    },
  },
  routes: {
    v1: {
      "/customer/licence": {
        GET: {
          public: {
            name: "get-customer-licence",
            integrations: [
              "dvlaAuthenticate",
              "dvlaGetCustomerLicence",
              "udpGetLinkingId",
            ],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
          },
        },
      },
      "/customer/vehicle/:id": {
        GET: {
          public: {
            name: "get-customer-vehicle",
            integrations: [
              "dvlaAuthenticate",
              "dvlaGetCustomerVehicle",
              "udpGetLinkingId",
            ],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
          },
        },
      },
      "/customer/vehicles": {
        GET: {
          public: {
            name: "get-customer-vehicles",
            integrations: [
              "dvlaAuthenticate",
              "dvlaGetCustomerVehicles",
              "udpGetLinkingId",
            ],
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
      "/vehicle-enquiry/:reg": {
        GET: {
          public: {
            name: "get-vehicle-enquiry",
            integrations: ["dvlaAuthenticate", "dvlaVehicleEnquiry"],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
          },
        },
      },
      "/share-code": {
        POST: {
          public: {
            name: "post-share-code",
            integrations: [
              "dvlaAuthenticate",
              "dvlaPostShareCode",
              "udpGetLinkingId",
            ],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
            response: SingleShareCodeResponseSchemaWithoutIdSchema,
          },
        },
      },
      "/share-code/:id/cancel": {
        POST: {
          public: {
            name: "cancel-share-code",
            integrations: [
              "dvlaAuthenticate",
              "dvlaCancelShareCode",
              "udpGetLinkingId",
            ],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
            response: SingleShareCodeResponseSchemaWithoutIdSchema,
          },
        },
      },
      "/unlink/:id": {
        POST: {
          private: {
            name: "unlink-user",
            integrations: [
              "dvlaAuthenticate",
              "dvlaUnlinkUser",
              "udpGetLinkingId",
            ],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
          },
        },
      },
    },
  },
});
