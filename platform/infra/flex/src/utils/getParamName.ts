import { getEnvConfig } from "../base/env";

const envConfig = getEnvConfig();

export function getParamName(name: string) {
  return `/${envConfig.env}${name}`;
}

export type FlexEphemeralParam = "/flex-core/private-gateway/url";
