import type { HttpMethod } from "@flex/utils";

import type { IacDomainConfig } from "../types";
import { parseIntegrationRoute } from "./integrations";
import { getDomainRouteEntries } from "./route-entries";

export type IntegrationViolationReason = "target-not-found" | "route-not-found";

export interface IntegrationViolation {
  sourceDomain: string;
  integrationKey: string;
  route: string;
  targetDomain: string;
  reason: IntegrationViolationReason;
}

interface PrivateRoute {
  method: HttpMethod;
  version: string;
  segments: string[];
}

const collectPrivateRoutes = (config: IacDomainConfig): PrivateRoute[] =>
  getDomainRouteEntries(config.routes)
    .filter(({ gateway }) => gateway === "private")
    .map(({ method, version, path }) => ({
      method,
      version,
      segments: path.split("/").filter(Boolean),
    }));

const segmentsMatch = (intSegments: string[], tgtSegments: string[]): boolean =>
  intSegments.every((segment, index) => {
    const target = tgtSegments[index];
    return target != null && (target.startsWith(":") || target === segment);
  });

const routeMatches = (
  parsed: ReturnType<typeof parseIntegrationRoute>,
  intSegments: string[],
  candidate: PrivateRoute,
): boolean => {
  const { method, version, isWildcard } = parsed;
  const { method: routeMethod, version: routeVersion, segments } = candidate;

  if (method !== routeMethod || version !== routeVersion) return false;

  const lengthMatches = isWildcard
    ? segments.length >= intSegments.length
    : segments.length === intSegments.length;

  return lengthMatches && segmentsMatch(intSegments, segments);
};

export const validateDomainIntegrations = (
  configs: IacDomainConfig[],
): IntegrationViolation[] => {
  const knownDomains = new Set(configs.map((config) => config.name));
  const privateRoutesByDomain = new Map(
    configs.map((config) => [config.name, collectPrivateRoutes(config)]),
  );

  return configs.flatMap((config) =>
    Object.entries(config.integrations ?? {})
      .filter(([, integration]) => integration.type === "domain")
      .map(([integrationKey, integration]): IntegrationViolation | null => {
        const { route, target } = integration;
        const sourceDomain = config.name;
        const targetDomain = target ?? sourceDomain;
        const base = { sourceDomain, integrationKey, route, targetDomain };

        if (!knownDomains.has(targetDomain)) {
          return { ...base, reason: "target-not-found" };
        }

        const parsed = parseIntegrationRoute(route);
        const intSegments = parsed.path.split("/").filter(Boolean);
        const candidates = privateRoutesByDomain.get(targetDomain) ?? [];
        const matched = candidates.some((candidate) =>
          routeMatches(parsed, intSegments, candidate),
        );

        return matched ? null : { ...base, reason: "route-not-found" };
      })
      .filter(
        (violation): violation is IntegrationViolation => violation !== null,
      ),
  );
};
