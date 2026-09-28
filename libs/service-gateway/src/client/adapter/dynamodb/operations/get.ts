import { GetCommand } from "@aws-sdk/lib-dynamodb";

import type { DynamoDBClient, DynamoDBGetOptions } from "../../../../types";
import { toKeyAttributes } from "../expressions";
import type { OperationContext } from "./context";

export function createGet<Item, Input>({
  table,
  client,
  execute,
  parseItem,
}: OperationContext<Item, Input>): DynamoDBClient<Item, Input>["get"] {
  return ({ key }: DynamoDBGetOptions<Item>) =>
    execute({
      operation: "GetItem",
      send: async () => {
        const { Item } = await client.send(
          new GetCommand({ TableName: table, Key: toKeyAttributes(key) }),
        );

        return Item === undefined ? undefined : parseItem(Item);
      },
    });
}
