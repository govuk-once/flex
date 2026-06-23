import type {
  DomainIntegration,
  DomainResource,
  IacDomainConfig,
} from "@flex/sdk";
import type { RouteAccess, Stage } from "@flex/utils";

import type { DomainRouteEntry } from "./deployment";
import { getDeployableRoutes } from "./deployment";

export interface FlatRoute extends DomainRouteEntry {
  readonly handlerPath: string;
}

export function flattenRoutes(
  config: IacDomainConfig,
  stage: Stage,
): readonly FlatRoute[] {
  return getDeployableRoutes(config, stage).map((r) => ({
    ...r,
    handlerPath: toHandlerPath(r.version, r.path, r.method, {
      gateway: r.gateway,
    }),
  }));
}

function resolveKeys<Definition>(
  keys: ReadonlySet<string>,
  definitions: Record<string, Definition> | undefined,
  fieldName: string,
): ReadonlyMap<string, Definition> {
  if (!definitions) return new Map();

  return new Map(
    Array.from(keys).map((key) => {
      const value = definitions[key];

      if (!value) {
        throw new Error(
          `"${key}" was included in route "${fieldName}" but was not found in domain ${fieldName}`,
        );
      }

      return [key, value] as const;
    }),
  );
}

interface RouteReference {
  resources?: Record<string, DomainResource>;
  integrations?: Record<string, DomainIntegration>;
}

export function resolveRouteReferences(
  routes: readonly FlatRoute[],
  { resources, integrations }: RouteReference,
) {
  const resourceKeys = new Set<string>();
  const integrationKeys = new Set<string>();

  for (const { routeConfig } of routes) {
    routeConfig.resources?.forEach((v) => resourceKeys.add(v));
    routeConfig.integrations?.forEach((v) => integrationKeys.add(v));
  }

  return [
    resolveKeys(resourceKeys, resources, "resources"),
    resolveKeys(integrationKeys, integrations, "integrations"),
  ] as const;
}

// ----------------------------------------------------------------------------
// Utility
// ----------------------------------------------------------------------------

function toHandlerPath(
  version: string,
  path: string,
  method: string,
  options?: { gateway?: "public" | "private" },
) {
  const resolvedPathWithParams = path.slice(1).replace(/:(\w+)/g, "[$1]");
  const fileExtension = options?.gateway === "private" ? ".private.ts" : ".ts";

  return `handlers/${version}/${resolvedPathWithParams}/${method.toLowerCase()}${fileExtension}`;
}

export function getFunctionAccess(routeAccess?: string, commonAccess?: string) {
  return (routeAccess ?? commonAccess ?? "isolated") as RouteAccess;
}

export function toPascalCase(value: string) {
  return value.replace(/(^|-)(\w)/g, (_, __, character: string) =>
    character.toUpperCase(),
  );
}
