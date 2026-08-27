import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { CountriesResponseSchema } from "./src/schemas/domain/country";
import {
  EventsQuerySchema,
  EventsResponseSchema,
} from "./src/schemas/domain/event";

export const { config, createHandler } = defineGateway({
  name: "travel",
  environments: ["development", "staging"],
  // DynamoDB and STS are reached over the public AWS endpoints via NAT, which
  // isolated subnets cannot route to.
  access: "private",
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/travel/consumer-config-secret",
      env: "FLEX_TRAVEL_CONSUMER_CONFIG_SECRET_ARN",
      scope: "environment",
      config: z.object({
        // The shared `sources` table, which holds every namespace, not just travel.
        sourcesTableName: NonEmptyString,
        eventStoreTableName: NonEmptyString,
        region: NonEmptyString,
        roleArn: NonEmptyString,
        externalId: NonEmptyString.optional(),
      }),
    },
    consumerRole: {
      type: "role",
      path: "/travel/consumer-role",
    },
  },
  routes: {
    "GET /v1/countries": {
      name: "getCountries",
      response: CountriesResponseSchema,
    },
    "GET /v1/events": {
      name: "events",
      query: EventsQuerySchema,
      response: EventsResponseSchema,
    },
  },
});
