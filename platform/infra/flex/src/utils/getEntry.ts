import { findProjectRoot, getEnvConfig } from "@flex/utils";

const { env } = getEnvConfig();

export function getDomainEntry(domain: string, path: string) {
  // /domains/hello/src/handlers/hello/get.ts
  return `${findProjectRoot()}/domains/${domain}/src/${path}`;
}

export function getPlatformEntry(domain: string, path: string) {
  // /platform/domains/auth/src/handler.ts
  return `${findProjectRoot()}/platform/domains/${domain}/src/${path}`;
}

export function getPlatformSmokeTestEntry(path: string) {
  return `${findProjectRoot()}/platform/smoke-test/src/${path}`;
}

export function getFlexParamName(path: string) {
  return `/${env}/flex-param${path}`;
}
