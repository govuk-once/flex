import { paginateQuery } from "@aws-sdk/lib-dynamodb";

import type { DynamoDBClient, DynamoDBQueryOptions } from "../../../../types";
import { toQueryExpressions } from "../expressions";
import { collectItems, countItems } from "../items";
import type { OperationContext } from "./context";

export function createQuery<Item, Input>({
  table,
  client,
  execute,
  parseItems,
}: OperationContext<Item, Input>): DynamoDBClient<Item, Input>["query"] {
  return ({ key, indexName, filter, sort }: DynamoDBQueryOptions<Item>) =>
    execute({
      operation: "Query",
      count: countItems,
      send: async () => {
        return parseItems(
          await collectItems(
            paginateQuery(
              { client },
              {
                TableName: table,
                ...(indexName && { IndexName: indexName }),
                ...(sort && { ScanIndexForward: sort === "asc" }),
                ...toQueryExpressions(key, filter),
              },
            ),
          ),
        );
      },
    });
}
