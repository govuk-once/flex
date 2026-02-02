import { findProjectRoot } from "@flex/utils";

export function getEntry(domain: string, path: string) {
  // /domains/hello/src/handlers/hello/get.ts
  return `${findProjectRoot()}/domains/${domain}/src/${path}`;
}

export function getPlatformEntry(domain: string, path: string) {
  // /platform/domains/auth/src/handler.ts
  return `${findProjectRoot()}/platform/domains/${domain}/src/${path}`;
}
