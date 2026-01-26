import type { QueryParams } from "./query-params";
import { extractQueryParams } from "./query-params";

export function buildUrl(baseUrl: string, path: string, params?: QueryParams) {
  const url = new URL(path, baseUrl);

  if (params) url.search = extractQueryParams(params)[0];

  return url;
}
