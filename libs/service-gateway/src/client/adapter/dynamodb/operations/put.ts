import type { NativeAttributeValue } from "@aws-sdk/lib-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

import type { DynamoDBClient, DynamoDBPutOptions } from "../../../../types";
import type { OperationContext } from "./context";

export function createPut<Item, Input>({
  table,
  client,
  execute,
  parseInput,
}: OperationContext<Item, Input>): DynamoDBClient<Item, Input>["put"] {
  return ({ item }: DynamoDBPutOptions<Input>) =>
    execute({
      operation: "PutItem",
      send: async () => {
        const parsed = parseInput(item);

        await client.send(
          new PutCommand({
            TableName: table,
            Item: parsed as Record<string, NativeAttributeValue>,
          }),
        );

        return parsed;
      },
    });
}
