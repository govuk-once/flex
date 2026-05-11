import { z } from "zod";

import { sanitiseStageName } from "./infra";

export const EnvironmentSchema = z.enum([
  "development",
  "staging",
  "production",
]);
export const Environment = EnvironmentSchema.enum;
export type Environment = z.output<typeof EnvironmentSchema>;

export type Stage = Environment | (string & {});

export function isPersistentEnvironment(stage: Stage): stage is Environment {
  return EnvironmentSchema.safeParse(stage).success;
}

export function isStageAllowed(
  environments: readonly Environment[] | undefined,
  stage: Stage,
) {
  if (!isPersistentEnvironment(stage)) return true;
  return environments?.includes(stage) ?? true;
}

interface EnvironmentConfig {
  readonly env: Environment;
  readonly stage: Stage;
  readonly persistent: boolean;
}

export function getEnvConfig(): EnvironmentConfig {
  const stage = sanitiseStageName(process.env.STAGE ?? process.env.USER);

  if (!stage) {
    throw new Error("STAGE or USER env var not set");
  }

  const persistent = isPersistentEnvironment(stage);

  return {
    env: persistent ? stage : Environment.development,
    stage,
    persistent,
  };
}
