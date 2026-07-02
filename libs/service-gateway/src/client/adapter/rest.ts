import { typedFetch } from "@flex/sdk";
import type { HttpMethod, ReadonlyRecord } from "@flex/utils";
import { extractQueryParams } from "@flex/utils";

import type { RestClient, RestWriteOperationOptions } from "../../types";
import type { RestAuth } from "../fetcher/build";
import { buildFetcher } from "../fetcher/build";

export type { RestAuth };

export interface RestClientOptions {
  readonly baseUrl: string;
  readonly auth: RestAuth;
  readonly headers?: ReadonlyRecord<string, string>;
}

export function createRestClient({
  auth,
  baseUrl,
  headers: baseHeaders,
}: RestClientOptions): RestClient {
  const fetcher = buildFetcher({ auth, baseUrl });

  const send = (
    method: HttpMethod,
    path: string,
    options: RestWriteOperationOptions = {},
  ) => {
    const { body, headers, schema, query } = options;

    const params = query ? extractQueryParams(query)[0] : "";
    const queryString = params ? `?${params}` : "";

    const url = query ? `${path}${queryString}` : path;

    const { request } = fetcher(url, {
      method,
      headers: { Accept: "application/json", ...baseHeaders, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return typedFetch(request, schema);
  };

  return {
    get: (path, options) => send("GET", path, options),
    post: (path, options) => send("POST", path, options),
    put: (path, options) => send("PUT", path, options),
    patch: (path, options) => send("PATCH", path, options),
    delete: (path, options) => send("DELETE", path, options),
  } as RestClient;
}
