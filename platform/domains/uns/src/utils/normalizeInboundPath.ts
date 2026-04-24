export function normalizeInboundPath(path: string): string {
  if (path.startsWith("/gateways/uns")) {
    const normalized = path.replace(/^\/gateways\/uns/, "");
    return normalized.length > 0 ? normalized : "/";
  }
  return path;
}
