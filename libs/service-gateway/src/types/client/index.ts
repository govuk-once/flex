import type { ReadonlyRecord } from "@flex/utils";

import type { DynamoClient } from "./dynamo";
import type { EventBusClient } from "./event-bus";
import type { RestClient } from "./rest";

export type * from "./event-bus";
export type * from "./rest";
export type * from "./dynamo";

export type GatewayClient = DynamoClient | RestClient | EventBusClient;

export type GatewayClientMap = ReadonlyRecord<string, GatewayClient>;
