import type { HttpMethod, IacDomainConfig } from "@flex/sdk";
import type { Stage } from "@flex/utils";
import { isPersistentEnvironment, isStageAllowed } from "@flex/utils";

type RouteGateway = NonNullable<
  IacDomainConfig["routes"][string][string][HttpMethod]
>;

export interface DomainRouteEntry {
  readonly version: string;
  readonly path: string;
  readonly routeKey: string;
  readonly method: HttpMethod;
  readonly gateway: "public" | "private";
  readonly routeConfig: NonNullable<RouteGateway["public" | "private"]>;
}

function getDomainRouteEntries(
  routes: IacDomainConfig["routes"],
): readonly DomainRouteEntry[] {
  const entries: DomainRouteEntry[] = [];

  for (const [version, paths] of Object.entries(routes)) {
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, gateways] of Object.entries(methods)) {
        for (const gateway of ["public", "private"] as const) {
          const routeConfig = gateways[gateway];

          if (!routeConfig) continue;

          entries.push({
            version,
            path,
            routeKey: `${method} /${version}${path}${gateway === "private" ? " [private]" : ""}`,
            method: method as HttpMethod,
            gateway,
            routeConfig,
          });
        }
      }
    }
  }

  return entries;
}

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
