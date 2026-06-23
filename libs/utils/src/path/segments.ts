export function toPathSegments(path: string) {
  return path ? (path.match(/[^/]+/g) ?? []) : [];
}

export function matchPathSegments(
  routeSegments: readonly string[],
  requestSegments: readonly string[],
): Record<string, string> | null {
  if (routeSegments.length !== requestSegments.length) return null;

  const params: Record<string, string> = {};

  const matched = routeSegments.every((segment, i) => {
    const value = requestSegments[i];

    if (value === undefined) return false;

    if (segment.startsWith(":")) {
      params[segment.slice(1)] = value;
      return true;
    }

    return segment === value;
  });

  return matched ? params : null;
}
