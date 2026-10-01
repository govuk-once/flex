import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

import type { DynamoDBClient, DynamoDBUpdateOptions } from "../../../../types";
import { toKeyAttributes, toUpdateExpressions } from "../expressions";
import type { OperationContext } from "./context";

export function createUpdate<Item, Input>({
  table,
  client,
  execute,
  parseItem,
}: OperationContext<Item, Input>): DynamoDBClient<Item, Input>["update"] {
  return ({ key, set, remove }: DynamoDBUpdateOptions<Item>) =>
    execute({
      operation: "UpdateItem",
      send: async () => {
        const { Attributes } = await client.send(
          new UpdateCommand({
            TableName: table,
            Key: toKeyAttributes(key),
            ...toUpdateExpressions(key, set, remove?.map(String)),
            ReturnValues: "ALL_NEW",
          }),
        );

        return parseItem(Attributes);
      },
    });
}
