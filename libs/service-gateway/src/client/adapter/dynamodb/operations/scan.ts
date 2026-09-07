import { paginateScan } from "@aws-sdk/lib-dynamodb";

import type { DynamoDBClient, DynamoDBScanOptions } from "../../../../types";
import { toScanExpressions } from "../expressions";
import { collectItems, countItems } from "../items";
import type { OperationContext } from "./context";

export function createScan<Item, Input>({
  table,
  client,
  execute,
  parseItems,
}: OperationContext<Item, Input>): DynamoDBClient<Item, Input>["scan"] {
  return ({ indexName, filter }: DynamoDBScanOptions<Item> = {}) =>
    execute({
      operation: "Scan",
      count: countItems,
      send: async () => {
        return parseItems(
          await collectItems(
            paginateScan(
              { client },
              {
                TableName: table,
                ...(indexName && { IndexName: indexName }),
                ...toScanExpressions(filter),
              },
            ),
          ),
        );
      },
    });
}
