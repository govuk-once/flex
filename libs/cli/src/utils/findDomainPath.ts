import { findProjectRoot } from "@flex/utils";

export function findDomainPath(domain: string) {
  return `${findProjectRoot()}/domains/${domain}`;
}
