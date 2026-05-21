export function createNormalizeInboundPath(prefix: string) {
  return function normalizeInboundPath(path: string): string {
    if (path.startsWith(prefix)) {
      const normalized = path.slice(prefix.length);
      return normalized.length > 0 ? normalized : "/";
    }
    return path;
  };
}
