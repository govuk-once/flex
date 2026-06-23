import { assertNever } from "@flex/utils";

import type {
  DownstreamClient,
  GatewayConfig,
  GatewayDownstream,
  GatewayResources,
} from "../types";
import { createEventBusClient, createRemoteApiClient } from "./adapters";

export function createDownstreamClient<Config extends GatewayConfig>(
  config: Config,
) {
  return buildClient(
    config.name,
    config.downstream,
    config.resources,
  ) as Promise<DownstreamClient<Config>>;
}

function buildClient(
  name: string,
  downstream: GatewayDownstream,
  resources: GatewayResources,
) {
  switch (downstream.type) {
    case "remote-api":
      return createRemoteApiClient(downstream, resources);
    case "event-bus":
      return createEventBusClient(name, downstream);
    default:
      return assertNever(downstream);
  }
}
