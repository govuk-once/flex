export function splitRouteKey(
  key: string,
): [method: string, path: string] | null {
  const [method, path] = key.split(" ");

  return method && path ? [method, path] : null;
}

export function splitVersionedPath(
  path: string,
): [version: string, path: string] | null {
  const [, version, ...parts] = path.split("/");

  return version && parts.length > 0 ? [version, `/${parts.join("/")}`] : null;
}
