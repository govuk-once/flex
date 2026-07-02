import type { ReadonlyRecord } from "@flex/utils";

import type { EventBusClient } from "./event-bus";
import type { RestClient } from "./rest";

export type * from "./event-bus";
export type * from "./rest";

export type GatewayClient = RestClient | EventBusClient;

export type GatewayClientMap = ReadonlyRecord<string, GatewayClient>;
