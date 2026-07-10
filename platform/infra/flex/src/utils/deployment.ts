import type { DomainRouteEntry, IacDomainConfig } from "@flex/sdk";
import { getDomainRouteEntries } from "@flex/sdk";
import type { ValidatedGatewayConfig } from "@flex/service-gateway";
import type { Stage } from "@flex/utils";
import { isPersistentEnvironment, isStageAllowed } from "@flex/utils";

export function getDeployableRoutes(
  config: IacDomainConfig,
  stage: Stage,
): readonly DomainRouteEntry[] {
  if (!isStageAllowed(config.environments, stage)) return [];

  return getDomainRouteEntries(config.routes).filter(({ routeConfig }) =>
    isStageAllowed(routeConfig.environments, stage),
  );
}

function buildRoutes(
  entries: readonly DomainRouteEntry[],
): IacDomainConfig["routes"] {
  const routes: IacDomainConfig["routes"] = {};

  for (const { version, path, method, gateway, routeConfig } of entries) {
    routes[version] ??= {};
    routes[version][path] ??= {};
    routes[version][path][method] ??= {};
    routes[version][path][method][gateway] = routeConfig;
  }

  return routes;
}

export function getDeployableDomains(
  configs: readonly IacDomainConfig[],
  stage: Stage,
): readonly IacDomainConfig[] {
  return configs.flatMap((config) => {
    if (!isPersistentEnvironment(stage)) return [config];

    const routes = getDeployableRoutes(config, stage);

    if (routes.length === 0) return [];

    return [{ ...config, routes: buildRoutes(routes) }];
  });
}

export function getDeployableServiceGateways(
  configs: readonly ValidatedGatewayConfig[],
  stage: Stage,
): readonly ValidatedGatewayConfig[] {
  return configs.filter(
    (config) =>
      !isPersistentEnvironment(stage) ||
      isStageAllowed(config.environments, stage),
  );
}
