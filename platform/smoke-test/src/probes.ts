import type { Environment } from "@flex/utils";

export const METRIC_NAMESPACE = "Flex/SmokeTest";

export const METRICS = {
  success: "SmokeTestSuccess",
  authRejected: "SmokeTestAuthRejected",
} as const;

export const DIMENSIONS = {
  environment: "Environment",
  journey: "Journey",
} as const;

export interface Probe {
  readonly journey: string;
  readonly path: string;
  readonly environments: readonly Environment[];
}

/**
 * One request per gateway dependency that a signed in test user can make
 * without any linked service. DVLA needs a linked licence and UNS needs a
 * registered push id, so those are left out for now.
 */
export const PROBES: readonly Probe[] = [
  {
    journey: "udp",
    path: "/app/udp/v1/users/me",
    environments: ["development", "staging", "production"],
  },
  {
    journey: "travel",
    path: "/app/travel/v1/countries",
    environments: ["development", "staging"],
  },
];

export function probesForEnvironment(env: Environment): readonly Probe[] {
  return PROBES.filter((probe) => probe.environments.includes(env));
}
