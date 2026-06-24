import type { HttpMethod } from "@flex/utils";

import type { IacDomainConfig } from "../types";

type RouteGateway = NonNullable<
  IacDomainConfig["routes"][string][string][HttpMethod]
>;

const GATEWAY_SUFFIX = { public: "", private: " [private]" } as const;

const GATEWAYS = ["public", "private"] as const;

export interface DomainRouteEntry {
  readonly version: string;
  readonly path: string;
  readonly routeKey: string;
  readonly method: HttpMethod;
  readonly gateway: "public" | "private";
  readonly routeConfig: NonNullable<RouteGateway["public" | "private"]>;
}

export const getDomainRouteEntries = (
  routes: IacDomainConfig["routes"],
): readonly DomainRouteEntry[] =>
  Object.entries(routes).flatMap(([version, paths]) =>
    Object.entries(paths).flatMap(([path, methods]) =>
      Object.entries(methods).flatMap(([method, gateways]) =>
        GATEWAYS.map((gateway) => ({ gateway, routeConfig: gateways[gateway] }))
          .filter(
            (
              entry,
            ): entry is Pick<DomainRouteEntry, "gateway" | "routeConfig"> =>
              entry.routeConfig != null,
          )
          .map(({ gateway, routeConfig }) => ({
            version,
            path,
            routeKey: `${method} /${version}${path}${GATEWAY_SUFFIX[gateway]}`,
            method: method as HttpMethod,
            gateway,
            routeConfig,
          })),
      ),
    ),
  );
