import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const { config, createHandler } = defineGateway({
  name: "dvla",
  environments: ["development", "staging"],
  access: "private",
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/dvla/consumer-config-secret-arn",
      env: "FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN",
      scope: "environment",
      config: z.object({
        apiKey: NonEmptyString,
        apiUrl: NonEmptyString,
        apiUsername: NonEmptyString,
        apiPassword: NonEmptyString,
        apiPublicKey: NonEmptyString,
        wellKnownJwkUrl: NonEmptyString,
      }),
    },
    encryptionKey: {
      type: "kms",
      path: "/flex-secret/encryption-key",
    },
  },
  downstream: {
    type: "remote-api",
    ref: "consumerConfig",
    auth: { type: "public" },
  },
  policy: {},
  routes: {
    "GET /v1/authenticate": {
      name: "getAuthenticate",
    },
    "GET /v1/licence/:id": {
      name: "getRetrieveDrivingLicences",
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "GET /v1/customer/:id": {
      name: "getRetrieveCustomer",
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "GET /v1/customer-summary/:id": {
      name: "getCustomerSummary",
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "GET /v1/driver-summary/:id": {
      name: "getDriverSummary",
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "GET /v1/vehicle-enquiry/:id": {
      name: "getVehicleEnquiryService",
    },
    "GET /v1/share-codes": {
      name: "getShareCodes",
      query: z.object({ linkingId: NonEmptyString }),
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "GET /v1/well-known-jwks": {
      name: "getWellKnownJwk",
    },
    "POST /v1/share-code": {
      name: "postShareCode",
      query: z.object({ linkingId: NonEmptyString }),
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "POST /v1/share-code/:id/cancel": {
      name: "postShareCodeCancel",
      query: z.object({ linkingId: NonEmptyString }),
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "POST /v1/test-notification/:id": {
      name: "postTestNotification",
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "POST /v1/unlink-user/:id": {
      name: "postUnlinkUser",
      headers: {
        auth: { name: "auth", required: true },
      },
    },
  },
});
