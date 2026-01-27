import type { HttpRequestOptions } from "@flex/utils";
import { buildRequest, buildUrl, parseResponseBody } from "@flex/utils";

interface CreateApiOptions {
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  status: number;
  statusText: string;
  headers: Headers;
  body?: T;
  raw: Response;
}

// ----------------------------------------------------------------------------
// HTTP Client
// ----------------------------------------------------------------------------

async function sendRequest<RequestBody, ResponseBody>(
  baseUrl: string,
  method: string,
  path: string,
  options: HttpRequestOptions<RequestBody>,
  apiOptions: CreateApiOptions = {},
): Promise<ApiResponse<ResponseBody>> {
  const { body, headers, params, signal } = options;
  const { signal: defaultSignal } = apiOptions;

  const url = buildUrl(baseUrl, path, params);
  const request = buildRequest(url, method, {
    body,
    headers,
    signal: signal ?? defaultSignal,
  });

  const response = await fetch(request);
  const clonedResponse = response.clone();
  const parsedBody = await parseResponseBody<ResponseBody>(response);

  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    body: parsedBody,
    raw: clonedResponse,
  };
}

function buildApiClient(baseUrl: string, apiOptions?: CreateApiOptions) {
  return {
    request: <Req, Res>(
      method: string,
      path: string,
      options: HttpRequestOptions<Req> = {},
    ) => sendRequest<Req, Res>(baseUrl, method, path, options, apiOptions),
    get: <Res>(path: string, options: HttpRequestOptions = {}) =>
      sendRequest<never, Res>(baseUrl, "GET", path, options, apiOptions),
    post: <Req, Res>(path: string, options: HttpRequestOptions<Req> = {}) =>
      sendRequest<Req, Res>(baseUrl, "POST", path, options, apiOptions),
    put: <Req, Res>(path: string, options: HttpRequestOptions<Req> = {}) =>
      sendRequest<Req, Res>(baseUrl, "PUT", path, options, apiOptions),
    patch: <Req, Res>(path: string, options: HttpRequestOptions<Req> = {}) =>
      sendRequest<Req, Res>(baseUrl, "PATCH", path, options, apiOptions),
    delete: <Res>(path: string, options: HttpRequestOptions = {}) =>
      sendRequest<never, Res>(baseUrl, "DELETE", path, options, apiOptions),
  };
}

export function createApi(baseUrl: string, options: CreateApiOptions = {}) {
  return {
    client: buildApiClient(baseUrl, options),
  };
}
