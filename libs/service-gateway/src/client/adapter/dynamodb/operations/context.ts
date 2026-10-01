import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import type { Execute } from "../execute";

export interface OperationContext<Item, Input> {
  readonly table: string;
  readonly client: DynamoDBDocumentClient;
  readonly execute: Execute;
  readonly parseItem: (item: unknown) => Item;
  readonly parseItems: (items: unknown[]) => Item[];
  readonly parseInput: (item: Input) => Item;
}
