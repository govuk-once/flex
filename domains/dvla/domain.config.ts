import {
  authenticateResponseSchema,
  customerDriversLicenceSchema,
  CustomerSummaryWithoutIdSchema,
  customerVehicleDetailsSchema,
  customerVehiclesResponseSchema,
  DriverSummaryWithoutIdSchema,
  MultiShareCodeResponseSchema,
  MultiShareCodeResponseSchemaWithoutIdSchmea,
  RetrieveCustomerSummaryByLinkingIdResponse,
  RetrieveDriverSummaryByLinkingIdResponse,
  SingleShareCodeResponseSchema,
  SingleShareCodeResponseSchemaWithoutIdSchema,
  vehicleEnquiryResponseSchema,
  viewDriverResponseSchema,
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
    dvlaGetShareCodes: {
      type: "gateway",
      target: "dvla",
      route: "GET /v1/share-codes",
      response: MultiShareCodeResponseSchema,
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
            integrations: [
              "dvlaAuthenticate",
              "dvlaDriverSummary",
              "dvlaVehicleEnquiry",
              "udpGetLinkingId",
            ],
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
      /**
       * The following endpoints are now deprecated, they will be removed once
       * the app has migrated across to the new endpoints
       */
      "/share-codes": {
        GET: {
          public: {
            name: "get-share-codes",
            integrations: [
              "dvlaAuthenticate",
              "dvlaGetShareCodes",
              "udpGetLinkingId",
            ],
            resources: ["flexPrivateGatewayUrl", "encryptionKeyArn"],
            response: MultiShareCodeResponseSchemaWithoutIdSchmea,
          },
        },
      },
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
            response: CustomerSummaryWithoutIdSchema,
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
            response: DriverSummaryWithoutIdSchema,
          },
        },
      },
    },
  },
});
