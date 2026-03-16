import { getEnvConfig } from "../base/env";

const envConfig = getEnvConfig();

export function getParamName(name: string) {
  return `/${envConfig.env}${name}`;
}
