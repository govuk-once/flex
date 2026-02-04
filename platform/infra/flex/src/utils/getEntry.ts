import { findProjectRoot } from "@flex/utils";

export function getDomainEntry(domain: string, path: string) {
  // /domains/hello/src/handlers/hello/get.ts
  return `${findProjectRoot()}/domains/${domain}/src/${path}`;
}

export function getPlatformEntry(domain: string, path: string) {
  // /platform/domains/auth/src/handler.ts
  return `${findProjectRoot()}/platform/domains/${domain}/src/${path}`;
}

export function getGatewayEntry(gatewayId: string, filePath: string) {
  // /platform/internal/gateways/udp/src/handler.ts
  return `${findRoot()}/platform/internal/gateways/${gatewayId}/src/${filePath}`;
}
