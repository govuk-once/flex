import { createRouteContext, createRouteHandler } from "./route";
import type {
  DomainConfig,
  DomainResult,
  InferEnvironmentKeys,
  InferFeatureFlagKeys,
  InferIntegrationKeys,
  InferResourceKeys,
} from "./types";

export function domain<
  const Config extends DomainConfig<
    InferResourceKeys<Config>,
    InferIntegrationKeys<Config>,
    InferFeatureFlagKeys<Config>,
    InferEnvironmentKeys<Config>
  >,
>(config: Config): DomainResult<Config> {
  return {
    config,
    route: createRouteHandler(config),
    routeContext: createRouteContext(config),
  };
}
