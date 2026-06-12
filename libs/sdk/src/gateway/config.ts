import { buildHandler } from "./handler";
import type { Gateway, GatewayConfig } from "./types";

export function defineGateway<const Config extends GatewayConfig>(
  config: Config,
): Gateway<Config> {
  return {
    config,
    createHandler: (handlers) => buildHandler(config, handlers),
  };
}
