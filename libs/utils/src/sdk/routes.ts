import type { HttpMethod } from "../schemas/common";

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

export function parseRouteKey(key: string): RouteKeyParts {
  const pathParts = splitRouteKey(key);

  if (pathParts === null) {
    throw new Error(
      `Invalid route key. Expected "METHOD /version/path", but got: "${key}"`,
    );
  }

  const [method, path] = pathParts;

  return { method: method as HttpMethod, path };
}
