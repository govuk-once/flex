import { defineGateway } from "@flex/sdk";
import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const { config, createHandler } = defineGateway({
  name: "dvla",
  environments: ["development", "staging"],
  access: "private",
  common: {
    function: { timeoutSeconds: 30 },
    headers: {
      auth: { required: true },
    },
  },
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/dvla/consumer-config-secret-arn",
      schema: z.object({
        apiKey: NonEmptyString,
        apiUrl: NonEmptyString,
        apiUsername: NonEmptyString,
        apiPassword: NonEmptyString,
        apiPublicKey: NonEmptyString,
      }),
    },
    encryptionKey: {
      type: "kms",
      path: "/flex-secret/encryption-key",
    },
  },
  integration: {
    source: "consumerConfig",
    auth: {
      headers: {
        Authorization: "$headers.auth",
        "X-API-KEY": "$resources.consumerConfig.apiKey",
      },
      signing: { type: "none" },
    },
  },
  routes: {
    v1: {
      "/authenticate": {
        GET: {
          operation: "POST /thirdparty-access/v1/authenticate",
          headers: {
            auth: { required: false },
          },
          integration: {
            auth: {
              headers: { "X-API-KEY": null },
            },
          },
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              userName: "$resources.consumerConfig.apiUsername",
              password: "$resources.consumerConfig.apiPassword", // pragma: allowlist secret
            },
          },
          response: z.any() /** AuthenticateResponseSchema */,
        },
      },
      "/licence/:id": {
        GET: {
          operation: "POST /full-driver-enquiry/v1/driving-licences/retrieve",
          path: z.any() /** z.object({ id: DrivingLicenceNumber }) */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              drivingLicenceNumber: "$path.id",
              includeCPC: false,
              includeTacho: false,
              acceptPartialResponse: false,
            },
          },
          response: z.any() /** GetLicenceResponseSchema */,
        },
      },
      "/customer/:id": {
        GET: {
          operation: "POST /govuk-app-service/v1/retrieve-customer-summary",
          path: z.any() /** z.object({ id: LinkingId }) */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              linkingId: "$path.id",
            },
          },
          response: z.any() /** GetCustomerResponseSchema */,
        },
      },
      "/customer-summary/:id": {
        GET: {
          operation: "POST /govuk-app-service/v1/retrieve-customer-summary",
          path: z.any() /** z.object({ id: LinkingId }) */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              linkingId: "$path.id",
            },
          },
          response: z.any() /** GetCustomerSummaryResponseSchema */,
        },
      },
      "/driver-summary/:id": {
        GET: {
          operation: "POST /govuk-app-service/v1/retrieve-driver-summary",
          path: z.any() /** z.object({ id: LinkingId }) */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              linkingId: "$path.id",
            },
          },
          response: z.any() /** GetDriverSummaryResponseSchema */,
        },
      },
      "/vehicle-enquiry/:id": {
        GET: {
          operation: "POST /vehicle-enquiry/v1/vehicles",
          path: z.any() /** z.object({ id: RegistrationNumber }) */,
          headers: {
            auth: { required: false },
          },
          integration: {
            auth: {
              headers: {
                "X-API-KEY": "$resources.consumerConfig.apiPublicKey",
              },
            },
          },
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              registrationNumber: "$path.id",
            },
          },
          response: z.any() /** VehicleEnquiryResponseSchema */,
        },
      },
      "/test-notification/:id": {
        POST: {
          operation: "POST /govuk-app-service/v1/test-notification",
          path: z.any() /** z.object({ id: LinkingId }) */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              linkingId: "$path.id",
            },
          },
        },
      },
      "/share-code": {
        POST: {
          operation:
            "POST /govuk-app-service/v1/create-driving-licence-share-code",
          query: z.any() /** z.object({ linkingId: LinkingId }) */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              linkingId: "$query.linkingId",
            },
          },
          response: z.any() /** SingleShareCodeResponseSchema */,
        },
      },
      "/share-codes": {
        GET: {
          operation:
            "POST /govuk-app-service/v1/list-driving-licence-share-codes",
          query: z.any() /** z.object({ linkingId: LinkingId }) */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              linkingId: "$query.linkingId",
            },
          },
          response: z.any() /** MultiShareCodeResponseSchema */,
        },
      },
      "/share-code/:id/cancel": {
        POST: {
          operation:
            "POST /govuk-app-service/v1/cancel-driving-licence-share-code",
          path: z.any() /** z.object({ id: Uuid }) */,
          query: z.any() /** z.object({ linkingId: LinkingId }) */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              linkingId: "$query.linkingId",
              tokenId: "$path.id",
            },
          },
          response: z.any() /** SingleShareCodeResponseSchema */,
        },
      },
      "/unlink-user/:id": {
        POST: {
          operation: "POST /govuk-app-service/v1/unlink-customer",
          path: z.any() /** z.object({ id: LinkingId }) */,
          integrationBody: z.any() /** TodoIntegrationRequestSchema */,
          transformRequest: {
            body: {
              linkingId: "$path.id",
            },
          },
        },
      },
    },
  },
});
