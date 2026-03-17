import { getEnvConfig } from "../base/env";

const envConfig = getEnvConfig();

export function getParamName(name: string) {
  return `/${envConfig.env}${name}`;
}

export function getStageParamName(name: string) {
  return `/${envConfig.stage}${name}`;
}
