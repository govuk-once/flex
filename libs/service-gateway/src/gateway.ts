import { buildHandler } from "./handler";
import type { Gateway, GatewayConfigInput, InferResources } from "./types";

export function defineGateway<
  const Config extends GatewayConfigInput<InferResources<Config>>,
>(config: Config): Gateway<Config> {
  return {
    config,
    createHandler: (handlers) => buildHandler(config, handlers),
  };
}
