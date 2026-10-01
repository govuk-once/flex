import { createDynamoDBClient, mapApiResult } from "@flex/service-gateway";

import { createHandler } from "../gateway.config";
import {
  SOURCE_NAMESPACE_ATTRIBUTE,
  TRAVEL_DATA_SESSION,
  TRAVEL_SOURCE_NAMESPACE,
} from "./contract/table";
import { toCountry, TravelSourceItemSchema } from "./schemas/domain/country";
import { toTravelEvent, TravelEventItemSchema } from "./schemas/domain/event";

export const handler = createHandler({
  clients: ({ consumerConfig }) => ({
    sources: createDynamoDBClient({
      table: consumerConfig.sourcesTableName,
      region: consumerConfig.region,
      schema: TravelSourceItemSchema,
      auth: {
        type: "role",
        roleArn: consumerConfig.roleArn,
        roleName: TRAVEL_DATA_SESSION,
        externalId: consumerConfig.externalId,
      },
    }),
    events: createDynamoDBClient({
      table: consumerConfig.eventStoreTableName,
      region: consumerConfig.region,
      schema: TravelEventItemSchema,
      auth: {
        type: "role",
        roleArn: consumerConfig.roleArn,
        roleName: TRAVEL_DATA_SESSION,
        externalId: consumerConfig.externalId,
      },
    }),
  }),
  routes: {
    "GET /v1/countries": async ({ clients: { sources } }) => {
      const result = await sources.scan({
        filter: {
          [SOURCE_NAMESPACE_ATTRIBUTE]: TRAVEL_SOURCE_NAMESPACE,
          sourceEnabled: true,
        },
      });

      return mapApiResult(result, (items) =>
        items.map(toCountry).sort((a, b) => a.country.localeCompare(b.country)),
      );
    },
    "GET /v1/events": async ({
      clients: { events },
      queryParams: { namespace, group },
    }) => {
      const result = await events.query({
        indexName: "timestamp-query",
        key: { compositeKey: `${namespace}/${group}` },
        sort: "desc",
      });

      return mapApiResult(result, (items) => items.map(toTravelEvent));
    },
  },
});
