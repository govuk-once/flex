export const METRIC_NAMESPACE = "Flex/SmokeTest";

export const METRICS = {
  /** 1 when the probe completed its journey, 0 when it did not. One datum per probe. */
  success: "SmokeTestSuccess",
  /** Number of probes in the run that were refused with a 401 or 403. */
  authRejected: "SmokeTestAuthRejected",
} as const;

export const DIMENSIONS = {
  environment: "Environment",
  journey: "Journey",
} as const;

export interface Probe {
  /** Stable key used in metric dimensions and alarm names. */
  readonly journey: string;
  readonly path: string;
  /** Mirrors the `environments` list of the domain that serves the route. */
  readonly environments: readonly string[];
}

/**
 * One request per gateway dependency that a signed in test user can make
 * without any linked service. DVLA needs a linked licence and UNS a
 * registered push id, so neither is probed yet.
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

export function probesForEnvironment(env: string): readonly Probe[] {
  return PROBES.filter((probe) => probe.environments.includes(env));
}
