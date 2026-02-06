import type { QueryParams } from "./query-params";
import { extractQueryParams } from "./query-params";

export function buildUrl(baseUrl: string, path: string, params?: QueryParams) {
  const url = new URL(
    path.startsWith("/") ? path.slice(1) : path,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  );

  if (params) url.search = extractQueryParams(params)[0];

  return url;
}
