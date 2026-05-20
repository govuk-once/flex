import type { HttpMethod, IacDomainConfig } from "@flex/sdk";
import type { Stage } from "@flex/utils";
import { isPersistentEnvironment, isStageAllowed } from "@flex/utils";

type RouteGateway = NonNullable<
  IacDomainConfig["routes"][string][string][HttpMethod]
>;

type Gateway = "public" | "private";

const GATEWAYS: Gateway[] = ["public", "private"];

export interface DomainRouteEntry {
  readonly version: string;
  readonly path: string;
  readonly routeKey: string;
  readonly method: HttpMethod;
  readonly gateway: Gateway;
  readonly routeConfig: NonNullable<RouteGateway[Gateway]>;
}

function getGatewayEntries(
  version: string,
  path: string,
  method: HttpMethod,
  gateways: RouteGateway,
): readonly DomainRouteEntry[] {
  return GATEWAYS.flatMap((gateway) => {
    const routeConfig = gateways[gateway];
    const routeKey = `${method} /${version}${path}${gateway === "private" ? " [private]" : ""}`;
    return routeConfig
      ? [{ version, path, method, gateway, routeKey, routeConfig }]
      : [];
  });
}

function getMethodEntries(
  version: string,
  path: string,
  methods: IacDomainConfig["routes"][string][string],
): readonly DomainRouteEntry[] {
  return Object.entries(methods).flatMap(([method, gateways]) =>
    getGatewayEntries(version, path, method as HttpMethod, gateways),
  );
}

function getDomainRouteEntries(
  routes: IacDomainConfig["routes"],
): readonly DomainRouteEntry[] {
  return Object.entries(routes).flatMap(([version, paths]) =>
    Object.entries(paths).flatMap(([path, methods]) =>
      getMethodEntries(version, path, methods),
    ),
  );
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
