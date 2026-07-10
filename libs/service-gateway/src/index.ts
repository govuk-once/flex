export { createRestClient } from "./client/adapter/rest";
export { createPublicFetch } from "./client/fetcher/public";
export { defineGateway } from "./config/gateway";
export type { ValidatedGatewayConfig } from "./schemas";
export { GatewayConfigSchema } from "./schemas";
export type {
  GatewayClient,
  GatewayClientBuilder,
  GatewayHandlerMap,
  GatewayLambda,
} from "./types";
export { mapApiResult } from "./utils/result";
