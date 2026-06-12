import type { GatewayConfig, Todo } from "./types";

function createGatewayHandler<const Config extends GatewayConfig>(
  config: Config,
) {
  return (_: Todo) => {
    return { handler: true };
  };
}

// TODO: implement
interface TransformConfig<Shape extends object> {
  merge: (base: Shape, overrides?: Shape) => Shape;
  source: Shape;
}

export interface HandlerHelpers {
  transformRequest?: <Shape extends object>(
    draft: Shape,
    config: TransformConfig<Shape>,
  ) => Shape;
  transformResponse?: <Shape extends object>(
    draft: Shape,
    config: TransformConfig<Shape>,
  ) => Shape;
}

interface Gateway<Config> {
  config: Config;
  createHandler: (routeHelpers?: Record<string, HandlerHelpers>) => Todo;
  context: Todo;
}

export function defineGateway<const Config extends GatewayConfig>(
  config: Config,
): Gateway<Config> {
  return {
    config,
    createHandler: createGatewayHandler(config),
  };
}
