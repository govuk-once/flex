import type { ReadonlyRecord } from "@flex/utils";

import type { DynamoDBClient } from "../../client/adapter/dynamodb";
import type { DynamoClient } from "./dynamo";
import type { EventBusClient } from "./event-bus";
import type { RestClient } from "./rest";

export type * from "./dynamo";
export type * from "./event-bus";
export type * from "./rest";

export type GatewayClient =
  | DynamoClient
  | DynamoDBClient<unknown>
  | RestClient
  | EventBusClient;

export type GatewayClientMap = ReadonlyRecord<string, GatewayClient>;
