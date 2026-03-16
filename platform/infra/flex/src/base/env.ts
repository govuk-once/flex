import { sanitiseStageName } from "@flex/utils";

export enum Environment {
  DEVELOPMENT = "development",
  STAGING = "staging",
  PRODUCTION = "production",
}

function isEnvironment(value?: string): value is Environment {
  if (!value) return false;
  return Object.values(Environment).includes(value as Environment);
}

/**
 * Returns the environment config for this deployment.
 */
export function getEnvConfig() {
  const stage = sanitiseStageName(process.env.STAGE ?? process.env.USER);

  if (!stage) {
    throw new Error("STAGE or USER env var not set");
  }

  const persistent = isEnvironment(stage);

  return {
    // For non persistent stages we default to development environment
    env: persistent ? stage : Environment.DEVELOPMENT,
    stage,
    persistent,
  };
}
