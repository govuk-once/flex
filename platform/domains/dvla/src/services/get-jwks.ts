import type { ApiResult } from "@flex/flex-fetch";
import { typedFetch } from "@flex/flex-fetch";
import { createPublicFetch } from "@flex/service-gateway";

import type { JwkSet } from "../schemas/remote/wellKnownJwk";

const WELL_KNOWN_JWKS_PATH = "/.well-known/jwks.json";

let cache: ApiResult<JwkSet> | null = null;

export async function getJwks(baseUrl: string, path = WELL_KNOWN_JWKS_PATH) {
  if (cache?.ok) return cache;

  const fetcher = createPublicFetch({ baseUrl });

  const { request } = fetcher(path, { method: "GET" });

  const result = await typedFetch<JwkSet>(request);

  if (result.ok) cache = result;

  return result;
}
