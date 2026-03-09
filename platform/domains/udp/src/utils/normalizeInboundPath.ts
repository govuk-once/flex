export function normalizeInboundPath(path: string): string {
  if (path.startsWith("/gateways/udp")) {
    const normalized = path.replace(/^\/gateways\/udp/, "");
    return normalized.length > 0 ? normalized : "/";
  }
  return path;
}
