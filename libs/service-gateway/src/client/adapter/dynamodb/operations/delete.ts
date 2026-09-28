import { DeleteCommand } from "@aws-sdk/lib-dynamodb";

import type { DynamoDBClient, DynamoDBDeleteOptions } from "../../../../types";
import { toKeyAttributes } from "../expressions";
import type { OperationContext } from "./context";

export function createDelete<Item, Input>({
  table,
  client,
  execute,
}: OperationContext<Item, Input>): DynamoDBClient<Item, Input>["delete"] {
  return ({ key }: DynamoDBDeleteOptions<Item>) =>
    execute({
      operation: "DeleteItem",
      send: async () => {
        await client.send(
          new DeleteCommand({ TableName: table, Key: toKeyAttributes(key) }),
        );
      },
    });
}
