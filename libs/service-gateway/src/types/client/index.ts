import type { DynamoClient } from "./dynamo";
import type { AnyDynamoDBClient } from "./dynamodb";
import type { EventBusClient } from "./event-bus";
import type { RestClient } from "./rest";

export type * from "./dynamo";
export type * from "./dynamodb";
export type * from "./event-bus";
export type * from "./rest";

export type GatewayClient =
  | DynamoClient
  | AnyDynamoDBClient
  | RestClient
  | EventBusClient;

export type GatewayClientMap = Readonly<Record<string, GatewayClient>>;
