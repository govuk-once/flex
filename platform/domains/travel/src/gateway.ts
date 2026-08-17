import { createDynamoClient, mapApiResult } from "@flex/service-gateway";

import { createHandler } from "../gateway.config";
import {
  SOURCE_NAMESPACE_ATTRIBUTE,
  TRAVEL_DATA_SESSION,
  TRAVEL_SOURCE_NAMESPACE,
} from "./contract/table";
import { toCountry, TravelSourceSchema } from "./schemas/domain/country";

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
  }),
  routes: {
    "GET /v1/countries": async ({ clients: { sources } }) => {
      const result = await sources.scan({
        attribute: SOURCE_NAMESPACE_ATTRIBUTE,
        value: TRAVEL_SOURCE_NAMESPACE,
        schema: TravelSourceSchema,
      });

      return mapApiResult(result, (rows) =>
        rows
          // sourceEnabled is operator-owned; a source turned off is not served.
          .filter(({ sourceEnabled }) => sourceEnabled)
          .map(toCountry)
          // Scan order is not stable, so sort for a repeatable list.
          .sort((a, b) => a.country.localeCompare(b.country)),
      );
    },
  },
});
