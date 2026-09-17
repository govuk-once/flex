import {
  createDynamoClient,
  createDynamoDBClient,
  mapApiResult,
} from "@flex/service-gateway";

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
    sources: createDynamoClient({
      tableName: consumerConfig.sourcesTableName,
      region: consumerConfig.region,
      auth: {
        type: "assume-role",
        region: consumerConfig.region,
        roleArn: consumerConfig.roleArn,
        roleName: TRAVEL_DATA_SESSION,
        externalId: consumerConfig.externalId,
      },
    }),
    events: createDynamoClient({
      tableName: consumerConfig.eventStoreTableName,
      region: consumerConfig.region,
      auth: {
        type: "assume-role",
        region: consumerConfig.region,
        roleArn: consumerConfig.roleArn,
        roleName: TRAVEL_DATA_SESSION,
        externalId: consumerConfig.externalId,
      },
    }),

    sourcesTable: createDynamoDBClient({
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
    eventsTable: createDynamoDBClient({
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
    "GET /v1/countries": async ({
      logger,
      clients: { sources, sourcesTable },
    }) => {
      const before = await sources.scan({
        attribute: SOURCE_NAMESPACE_ATTRIBUTE,
        value: TRAVEL_SOURCE_NAMESPACE,
        schema: TravelSourceItemSchema,
      });
      const after = await sourcesTable.scan({
        filter: {
          sourceNamespace: TRAVEL_SOURCE_NAMESPACE,
          sourceEnabled: true,
        },
      });

      const result = mapApiResult(before, (rows) =>
        rows
          .filter(({ sourceEnabled }) => sourceEnabled)
          .map(toCountry)
          .sort((a, b) => a.country.localeCompare(b.country)),
      );

      logger.info("Scan result: ", {
        before,
        beforeMapped: result,
        after,
        afterMapped: after
          .map(toCountry)
          .sort((a, b) => a.country.localeCompare(b.country)),
      });

      return result;
    },
    "GET /v1/events": async ({
      logger,
      clients: { events, eventsTable },
      queryParams: { namespace, group },
    }) => {
      const before = await events.query({
        indexName: "timestamp-query",
        partitionKey: "compositeKey",
        partitionValue: `${namespace}/${group}`,
        scanIndexForward: false,
        schema: TravelEventItemSchema,
      });
      const after = await eventsTable.query({
        indexName: "timestamp-query",
        key: { compositeKey: `${namespace}/${group}` },
        sort: "desc",
      });

      const result = mapApiResult(before, (items) => items.map(toTravelEvent));

      logger.info("Query result: ", {
        before,
        beforeMapped: result,
        after,
        afterMapped: after.map(toTravelEvent),
      });

      return result;
    },
  },
});
