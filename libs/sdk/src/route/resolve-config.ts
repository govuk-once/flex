import type { ZodType } from "zod";

import type {
  DomainConfig,
  DomainFeatureFlag,
  DomainIntegrations,
  DomainResource,
  FlexEnvironment,
  HeaderConfig,
  HttpMethod,
  LogLevel,
  RouteAccess,
} from "../types";

interface RouteConfigOptions {
  readonly version: string;
  readonly path: string;
  readonly method: HttpMethod;
  readonly gateway: "public" | "private";
}

interface ResolvedRouteConfig {
  readonly name: string;
  readonly access?: RouteAccess;
  readonly logLevel?: LogLevel;
  readonly query?: ZodType;
  readonly body?: ZodType;
  readonly response?: ZodType;
  readonly resources?: readonly string[];
  readonly integrations?: readonly string[];
  readonly featureFlags?: readonly string[];
  readonly headers?: Readonly<Record<string, HeaderConfig>>;
}

export function getRouteConfig(
  config: DomainConfig,
  { version, path, method, gateway }: RouteConfigOptions,
): ResolvedRouteConfig {
  const routeConfig = config.routes[version]?.[path]?.[method]?.[gateway];

  if (!routeConfig) {
    throw new Error(
      `Route config for "${method} /${version}${path}${gateway === "private" ? " [private]" : ""}" does not exist`,
    );
  }

  return routeConfig;
}

export interface ResolvedResource {
  type: DomainResource["type"];
  value: string;
}

/**
 * Resolves resource values from their source
 *
 * - `kms`, `ssm`: Values are known at deploy time and injected as env vars, which are read directly from process.env.
 * - `secret`, `ssm:runtime`: Values are fetched at runtime via Middy middleware and attached to the lambda context, so the env var refers to the resource name NOT the value
 */
export function getRouteResources(
  resources: DomainConfig["resources"],
  resourceKeys?: readonly string[],
): ReadonlyMap<string, ResolvedResource> | undefined {
  if (!resources || !resourceKeys?.length) return;

  return new Map(
    resourceKeys.map((key) => {
      const resource = resources[key];

      if (!resource) {
        throw new Error(
          `"${key}" referenced in "resources" but was not defined in domain resources`,
        );
      }

      const value = process.env[key];

      if (!value) {
        throw new Error(
          `Environment variable "${key}" not set. Has this resource been provisioned?`,
        );
      }

      return [key, { type: resource.type, value }] as const;
    }),
  );
}

export interface ResolvedFeatureFlag {
  value: boolean;
}

const NAMED_ENVIRONMENTS: ReadonlySet<string> = new Set([
  "development",
  "staging",
  "production",
]);

function resolveCurrentEnvironment(): FlexEnvironment {
  const stage = process.env.STAGE;
  if (stage && NAMED_ENVIRONMENTS.has(stage)) {
    return stage as FlexEnvironment;
  }
  return "development";
}

/**
 * Resolves feature flag values.
 *
 * Resolution order (first defined wins):
 * 1. `process.env[key]`: explicit runtime override ("true" / "false")
 * 2. `environments[currentEnvironment]`: environment-specific value
 * 3. `default`: global fallback
 * 4. `false`
 *
 * The current environment is read from `process.env.STAGE`. Any stage that is
 * not one of "development", "staging", or "production" (e.g. a personal stage)
 * is treated as "development".
 */
export function getRouteFeatureFlags(
  featureFlags: DomainConfig["featureFlags"],
  flagKeys?: readonly string[],
): ReadonlyMap<string, ResolvedFeatureFlag> | undefined {
  if (!featureFlags || !flagKeys?.length) return;

  const currentEnvironment = resolveCurrentEnvironment();

  return new Map(
    flagKeys.map((key) => {
      const flag = featureFlags[key] as DomainFeatureFlag | undefined;

      if (!flag) {
        throw new Error(
          `"${key}" referenced in "featureFlags" but was not defined in domain featureFlags`,
        );
      }

      const envOverride = process.env[key];
      const value =
        envOverride !== undefined
          ? envOverride === "true"
          : (flag.environments?.[currentEnvironment] ?? flag.default ?? false);

      return [key, { value }] as const;
    }),
  );
}

export function getRouteIntegrations(
  integrations?: DomainIntegrations,
  keys?: readonly string[],
): DomainIntegrations | undefined {
  if (!integrations || !keys?.length) return;

  return Object.fromEntries(
    keys.map((key) => {
      const integration = integrations[key];

      if (!integration) {
        throw new Error(
          `"${key}" referenced in "integrations" but the domain integration has not been defined`,
        );
      }

      return [key, integration];
    }),
  );
}

export function getRouteAccess(common?: RouteAccess, route?: RouteAccess) {
  return route ?? common ?? "isolated";
}

export function getRouteLogLevel(common?: LogLevel, route?: LogLevel) {
  return route ?? common ?? "INFO";
}
