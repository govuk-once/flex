import { getEnvConfig } from "@platform/gov-uk-once";

const envConfig = getEnvConfig();

export function generateParamName(name: string) {
  // /development/flex-platform/cache/redis/endpoint
  return `/${envConfig.environment}/flex-platform${name}`;
}

export const SsmKeys = {
  redisEndpoint: generateParamName("/cache/redis/endpoint"),
} as const;
