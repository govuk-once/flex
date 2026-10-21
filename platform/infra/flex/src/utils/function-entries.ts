import type { IacDomainConfig } from "@flex/sdk";
import type { ValidatedGatewayConfig } from "@flex/service-gateway";
import type { Stage } from "@flex/utils";
import {
  Environment,
  getEnvConfig,
  isPersistentEnvironment,
} from "@flex/utils";

import { getServiceGatewayConfigs } from "./config-loader";
import {
  getDeployableDomains,
  getDeployableServiceGateways,
} from "./deployment";
import {
  getDomainEntry,
  getPlatformEntry,
  getPlatformSmokeTestEntry,
} from "./getEntry";
import { getDomainConfigs } from "./getDomainConfigs";
import { flattenRoutes, toPascalCase } from "./routes";

/**
 * Represents a team-authored Lambda function entry point that needs to be
 * bundled, signed, and deployed.
 */
export interface FunctionEntry {
  /**
   * Stable identifier for the function (matches the CDK construct ID).
   */
  readonly id: string;
  /**
   * Absolute path to the source handler file.
   */
  readonly entry: string;
  /**
   * Associated domain name, if domain-scoped.
   */
  readonly domain?: string;
  /**
   * The architectural category of this function.
   */
  readonly category:
    | "domain-route"
    | "service-gateway"
    | "platform"
    | "credential-monitor"
    | "smoke-test"
    | "core";
}

export interface EnumerateFunctionEntriesOptions {
  /**
   * Deployment stage (e.g. 'development', 'staging', 'production').
   * Defaults to the stage configured in the environment.
   */
  readonly stage?: Stage;
  /**
   * Domain configurations to enumerate.
   * If not provided, loads dynamically via `getDomainConfigs()`.
   */
  readonly domainConfigs?: readonly IacDomainConfig[];
  /**
   * Service gateway configurations to enumerate.
   * If not provided, loads dynamically via `getServiceGatewayConfigs()`.
   */
  readonly serviceGatewayConfigs?: readonly ValidatedGatewayConfig[];
  /**
   * Whether to include functions from all stages/environments regardless
   * of current stage filters (useful for CI exhaustive signing).
   */
  readonly includeAllStages?: boolean;
  /**
   * Optional target domain filter (matches `process.env.domain` behavior in `app.ts`).
   */
  readonly targetDomain?: string;
}

/**
 * Deterministically enumerates every team-authored Lambda function entry point
 * synthesized by the application.
 *
 * This function serves as the single source of truth shared by:
 * 1. The CI signing pipeline (so CI cannot miss any Lambda).
 * 2. The CDK application constructs and parity tests.
 */
export async function enumerateFunctionEntries(
  options: EnumerateFunctionEntriesOptions = {},
): Promise<readonly FunctionEntry[]> {
  const currentEnvConfig = getEnvConfig();
  const stage = options.stage ?? currentEnvConfig.stage;
  const isDev = stage === Environment.development;
  const isPersistent = isPersistentEnvironment(stage);
  const includeAll = options.includeAllStages ?? false;

  const [rawDomainConfigs, rawServiceGatewayConfigs] = await Promise.all([
    options.domainConfigs ?? getDomainConfigs(),
    options.serviceGatewayConfigs ?? getServiceGatewayConfigs(),
  ]);

  const deployableDomainConfigs = includeAll
    ? rawDomainConfigs
    : getDeployableDomains(rawDomainConfigs, stage);

  const deployableServiceGateways = includeAll
    ? rawServiceGatewayConfigs
    : getDeployableServiceGateways(rawServiceGatewayConfigs, stage);

  const entries: FunctionEntry[] = [];
  const seenIds = new Set<string>();

  function addEntry(entry: FunctionEntry) {
    if (seenIds.has(entry.id)) {
      throw new Error(
        `Duplicate function ID detected during enumeration: "${entry.id}". All Lambda function IDs must be globally unique.`,
      );
    }
    seenIds.add(entry.id);
    entries.push(entry);
  }

  // 1. Domain Route Handlers
  const targetDomain = includeAll
    ? undefined
    : (options.targetDomain ?? process.env.domain);

  for (const domain of deployableDomainConfigs) {
    if (targetDomain && targetDomain !== domain.name) continue;
    const routes = flattenRoutes(domain, stage);
    for (const route of routes) {
      const functionId = toPascalCase(
        `${domain.name}-${route.gateway}-${route.version}-${route.routeConfig.name}`,
      );
      addEntry({
        id: functionId,
        entry: getDomainEntry(domain.name, route.handlerPath),
        domain: domain.name,
        category: "domain-route",
      });
    }
  }

  // 2. Service Gateway Handlers
  for (const gateway of deployableServiceGateways) {
    const functionId = `${toPascalCase(gateway.name)}ServiceGateway`;
    addEntry({
      id: functionId,
      entry: getPlatformEntry(gateway.name, "gateway.ts"),
      domain: gateway.name,
      category: "service-gateway",
    });
  }

  // 3. Platform Stack Functions
  // Authorizer function (runs across all environments)
  addEntry({
    id: "AuthorizerFunction",
    entry: getPlatformEntry("auth", "handler.ts"),
    domain: "auth",
    category: "platform",
  });

  // JWKS stub endpoint (only instantiated in development environment)
  if (isDev || includeAll) {
    addEntry({
      id: "JwksEndpointStubFunction",
      entry: getPlatformEntry("auth", "functions/jwks-endpoint.ts"),
      domain: "auth",
      category: "platform",
    });
  }

  // 4. Credential Monitor Function (runs in persistent environments)
  if (isPersistent || includeAll) {
    addEntry({
      id: "CredentialMonitorFunction",
      entry: getPlatformEntry("credential-monitor", "handler.ts"),
      domain: "credential-monitor",
      category: "credential-monitor",
    });
  }

  // 5. Smoke Test Function (runs in persistent environments)
  if (isPersistent || includeAll) {
    addEntry({
      id: "SmokeTestFunction",
      entry: getPlatformSmokeTestEntry("handler.ts"),
      domain: "smoke-test",
      category: "smoke-test",
    });
  }

  // 6. DVLA Secret Rotation (in FlexCoreStack for persistent environments)
  if (isPersistent || includeAll) {
    addEntry({
      id: "DvlaSecretRotation",
      entry: getPlatformEntry("dvla-secret-rotation", "handler.ts"),
      domain: "dvla",
      category: "core",
    });
  }

  return Object.freeze(entries);
}
