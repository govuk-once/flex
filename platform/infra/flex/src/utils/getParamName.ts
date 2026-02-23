import { getEnvConfig } from "@platform/gov-uk-once";

const envConfig = getEnvConfig();

export function getParamName(name: string) {
  return `/${envConfig.environment}${name}`;
}

/** Flex Secrets */
export type FlexPlatformParam = "/flex-core/private-gateway/url";
