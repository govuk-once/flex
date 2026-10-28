import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const { config, createHandler } = defineGateway({
  name: "dvsa",
  environments: ["development", "staging"],
  access: "private",
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/dvsa/consumer-config-secret-arn-nathan",
      env: "FLEX_DVSA_CONSUMER_CONFIG_SECRET_ARN",
      scope: "environment",
      config: z.object({
        clientId: NonEmptyString,
        clientSecret: NonEmptyString,
        apiKey: NonEmptyString,
        apiAuthUrl: NonEmptyString,
        apiMotUrl: NonEmptyString,
      }),
    },
    encryptionKey: {
      type: "kms",
      path: "/secret/encryption-key",
    },
  },
  routes: {
    "GET /v1/authenticate": {
      name: "getAuthenticate",
    },
    "GET /v1/vehicle/mot/:id": {
      name: "getVehicleMot",
      headers: {
        auth: { name: "auth", required: true },
      },
    },
  },
});
