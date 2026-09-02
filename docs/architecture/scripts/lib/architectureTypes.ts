/**
 * Shape of docs/architecture/architecture-facts.json.
 *
 * Written by architectureFacts.ts and read back by buildArchitectureExplorer.ts to check
 * that the counts on the diagrams still match the domain and gateway configs. Both ends
 * import these types so a change to the emitted shape breaks the reader at compile time.
 */

export const STAGES = ["development", "staging", "production"] as const;

export type Stage = (typeof STAGES)[number];
export type StageKey = Stage | "ephemeral";
export type Gateway = "public" | "private";

/** A count broken down by stage, as every total in the facts file is. */
export type PerStage = Record<StageKey, number>;

export interface RouteFact {
  version: string;
  path: string;
  method: string;
  gateway: Gateway;
  name: string;
  access: string;
  /** Present only when the route gates independently of its domain. */
  environments?: string[];
}

export interface DomainFact {
  name: string;
  environments: string[] | null;
  commonAccess: string;
  timeoutSeconds: number | null;
  routes: RouteFact[];
  counts: { public: number; private: number; total: number };
  perStage: PerStage;
  integrations: { key: string; type: string; target: string; route: string }[];
  resources: {
    key: string;
    type: string;
    path: string;
    scope: string | null;
  }[];
  featureFlags: string[];
}

export interface GatewayFact {
  name: string;
  environments: string[];
  access: string;
  routeCount: number;
  routes: string[];
  resources: { key: string; type: string; path: string; env: string | null }[];
}

/** One CloudWatch alarm, read out of the CDK construct that creates it. */
export interface AlarmFact {
  id: string;
  source: string;
  alarmName?: string;
  metric?: string;
  statistic?: string;
  threshold?: string;
  comparison?: string;
  evaluationPeriods?: string;
  datapointsToAlarm?: string;
  treatMissingData?: string;
  stdDevs?: string;
  action?: string;
}

export interface ArchitectureFacts {
  /** The config globs and source directories the facts were derived from. */
  generatedFrom: string;
  domains: DomainFact[];
  gateways: GatewayFact[];
  totals: {
    domains: number;
    gateways: number;
    routeFunctions: PerStage;
    byTier: { egress: PerStage; isolated: PerStage };
    routeMethods: { public: PerStage; private: PerStage };
    domainsWithPublicRoutes: PerStage;
  };
  alarms?: AlarmFact[];
}

/* ------------------------------------------------------------------------------------ *
 * Config inputs
 *
 * A structural subset of domain.config.ts and gateway.config.ts — only the fields this
 * tooling actually reads. Deliberately not imported from @flex/sdk: the docs build should
 * not pull in the SDK's type graph, and a config field this tooling never reads cannot
 * break it. If a field here stops matching the real config, the derived counts are wrong
 * and the explorer build will say so.
 * ------------------------------------------------------------------------------------ */

export interface RouteConfigShape {
  name: string;
  access?: string;
  environments?: string[];
}

/** routes[version][path][method][gateway] */
export type RouteTree = Record<
  string,
  Record<string, Record<string, Partial<Record<Gateway, RouteConfigShape>>>>
>;

export interface DomainConfigShape {
  name: string;
  environments?: string[] | null;
  common?: { access?: string; function?: { timeoutSeconds?: number } };
  routes: RouteTree;
  integrations?: Record<
    string,
    { type: string; target?: string; route: string }
  >;
  resources?: Record<string, { type: string; path: string; scope?: string }>;
  featureFlags?: Record<string, unknown>;
}

export interface GatewayConfigShape {
  name: string;
  access: string;
  environments: string[];
  routes: Record<string, unknown>;
  resources?: Record<string, { type: string; path: string; env?: string }>;
}
