/**
 * Strips the gateway/domain prefix from an inbound path to get the "clean" downstream path.
 * @param path - The full inbound request path (e.g., /gateways/dvla/vehicles)
 * @param domainName - The name of the domain (e.g., "dvla" or "udp")
 */
export function normalizeInboundPath(path: string, domainName: string): string {
  const prefix = `/gateways/${domainName}`;

  if (path.startsWith(prefix)) {
    const normalized = path.replace(prefix, "");
    // Ensure we return "/" if the path was exactly the prefix
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }

  return path;
}
