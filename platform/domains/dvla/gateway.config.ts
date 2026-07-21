import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const { config, createHandler } = defineGateway({
  name: "dvla",
  environments: ["development", "staging", "production"],
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
        wellKnownJwkUrl: NonEmptyString,
      }),
    },
    encryptionKey: {
      type: "kms",
      path: "/secret/encryption-key",
    },
  },
  policy: {},
  routes: {
    "GET /v1/authenticate": {
      name: "getAuthenticate",
    },
    "GET /v1/customer/licence": {
      name: "getCustomerLicence",
      query: z.object({ linkingId: NonEmptyString }),
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "GET /v1/customer/vehicles": {
      name: "getCustomerVehicles",
      query: z.object({ linkingId: NonEmptyString }),
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "GET /v1/customer/vehicle/:id": {
      name: "getCustomerVehicle",
      query: z.object({ linkingId: NonEmptyString }),
      headers: {
        auth: { name: "auth", required: true },
      },
    },
    "GET /v1/vehicle-enquiry/:id": {
      name: "getVehicleEnquiryService",
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
