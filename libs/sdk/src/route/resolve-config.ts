import type {
  HeaderConfig,
  HttpMethod,
  LogLevel,
  RouteAccess,
} from "@flex/utils";
import { Environment, isPersistentEnvironment } from "@flex/utils";
import type { ZodType } from "zod";

import type {
  DomainConfig,
  DomainIntegrations,
  DomainResource,
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
): Readonly<Record<string, ResolvedResource>> | undefined {
  if (!resources || !resourceKeys?.length) return;

  return Object.fromEntries(
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

function resolveCurrentEnvironment(): Environment {
  const stage = process.env.STAGE;
  return stage && isPersistentEnvironment(stage)
    ? stage
    : Environment.development;
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
): Readonly<Record<string, boolean>> | undefined {
  if (!featureFlags || !flagKeys?.length) return;

  const currentEnvironment = resolveCurrentEnvironment();

  return Object.fromEntries(
    flagKeys.map((key) => {
      const flag = featureFlags[key];

      if (!flag) {
        throw new Error(
          `"${key}" referenced in "featureFlags" but was not defined in domain featureFlags`,
        );
      }

      const envOverride = process.env[key];

      const envFallback =
        flag.environments?.includes(currentEnvironment) ||
        (flag.default ?? false);

      const value =
        envOverride === undefined ? envFallback : envOverride === "true";

      return [key, value] as const;
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

export function getRouteLogLevel(
  common?: LogLevel,
  route?: LogLevel,
): LogLevel {
  return route ?? common ?? "INFO";
}
