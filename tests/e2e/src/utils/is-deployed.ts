import type { DomainConfig, DomainRoutes, IacDomainConfig } from "@flex/sdk";
import { getEnvConfig, isStageAllowed } from "@flex/utils";

export function isDomainDeployed(config: IacDomainConfig) {
  return isStageAllowed(config.environments, getEnvConfig().stage);
}

function findRouteByKey(routes: IacDomainConfig["routes"], routeKey: string) {
  for (const [version, paths] of Object.entries(routes)) {
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, gateways] of Object.entries(methods)) {
        for (const gateway of ["public", "private"] as const) {
          const config = gateways[gateway];

          if (!config) continue;

          const key = `${method} /${version}${path}${gateway === "private" ? " [private]" : ""}`;

          if (key === routeKey) return config;
        }
      }
    }
  }
}

export function isRouteDeployed<Config extends DomainConfig>(
  config: Config,
  routeKey: DomainRoutes<Config>,
) {
  const { stage } = getEnvConfig();

  if (!isStageAllowed(config.environments, stage)) return false;

  const routeConfig = findRouteByKey(config.routes, routeKey);

  if (!routeConfig) return false;

  return isStageAllowed(routeConfig.environments, stage);
}
