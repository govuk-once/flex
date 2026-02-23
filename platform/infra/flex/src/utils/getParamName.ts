import { getEnvConfig } from "@platform/gov-uk-once";

const envConfig = getEnvConfig();

export function getParamName(name: string) {
  return `/${envConfig.environment}/${envConfig.stage}${name}`;
}

export type FlexEphemeralParam = "/flex-core/private-gateway/url";
