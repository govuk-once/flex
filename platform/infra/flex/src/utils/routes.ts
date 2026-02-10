import type {
  DomainIntegration,
  DomainResource,
  IacDomainConfig,
  RouteAccess,
} from "@flex/sdk";
import type { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";

type RouteGateway = NonNullable<
  IacDomainConfig["routes"][string][string][string]
>;

export interface FlatRoute {
  readonly version: string;
  readonly path: string;
  readonly method: HttpMethod;
  readonly gateway: "public" | "private";
  readonly handlerPath: string;
  readonly routeConfig: NonNullable<RouteGateway["public" | "private"]>;
}

export function flattenRoutes(
  routes: IacDomainConfig["routes"],
): readonly FlatRoute[] {
  const entries: FlatRoute[] = [];

  for (const [version, paths] of Object.entries(routes)) {
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, gateways] of Object.entries(methods)) {
        if (!gateways) continue;

        for (const gateway of ["public", "private"] as const) {
          const routeConfig = gateways[gateway];

          if (routeConfig) {
            entries.push({
              version,
              path,
              method: method as HttpMethod,
              gateway,
              handlerPath: toHandlerPath(version, path, method, { gateway }),
              routeConfig,
            });
          }
        }
      }
    }
  }

  return entries;
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

export function toApiGatewayPath({
  domain,
  gateway,
  path,
  version,
}: {
  domain: string;
  gateway: "public" | "private";
  version: string;
  path: string;
}) {
  const resolvedPathWithParams = path.replace(/:(\w+)/g, "{$1}");

  return gateway === "private"
    ? `domains/${domain}/${version}${resolvedPathWithParams}`
    : `app/${version}${resolvedPathWithParams}`;
}

export function toPascalCase(value: string) {
  return value.replace(/(^|-)(\w)/g, (_, __, character: string) =>
    character.toUpperCase(),
  );
}
