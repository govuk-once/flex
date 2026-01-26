import type { RequestInit } from "undici-types";

import type { QueryParams } from "./query-params";

export interface HttpRequestOptions<Body = never> {
  body?: Body;
  headers?: Record<string, string>;
  params?: QueryParams;
  signal?: AbortSignal;
}

export interface BuildRequestOptions<Body = never> extends Omit<
  RequestInit,
  "body" | "method"
> {
  body?: Body;
  headers?: Record<string, string>;
}

export function buildRequest<Body>(
  url: URL,
  method: string,
  options: BuildRequestOptions<Body> = {},
): Request {
  const { body, headers, signal } = options;

  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body != null ? JSON.stringify(body) : undefined,
    signal,
  });
}

export async function parseResponseBody<Body>(
  response: Response,
): Promise<Body | undefined> {
  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0"
  ) {
    return undefined;
  }

  const text = await response.text();

  if (!text) return undefined;

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as Body;
    } catch {
      return text as Body;
    }
  }

  return text as Body;
}
