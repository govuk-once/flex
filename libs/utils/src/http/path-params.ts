export function toPathSegments(path: string) {
  return path.match(/[^/]+/g) ?? [];
}

export function matchPath(
  routeSegments: readonly string[],
  pathSegments: readonly string[],
): Record<string, string> | null {
  if (routeSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  const matched = routeSegments.every((segment, i) => {
    const value = pathSegments[i];

    if (value === undefined) return false;

    if (segment.startsWith(":")) {
      params[segment.slice(1)] = value;
      return true;
    }

    return segment === value;
  });

  return matched ? params : null;
}
