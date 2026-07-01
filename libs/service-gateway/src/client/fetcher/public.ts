import type { FlexFetchRequestInit } from "@flex/flex-fetch";
import { flexFetch } from "@flex/flex-fetch";

function normaliseHeaders(
  headers: Headers | Record<string, string> | [string, string][] | undefined,
) {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers ?? {};
}

export function createPublicFetch(config: { baseUrl: string }) {
  return (url: string, options?: FlexFetchRequestInit) => {
    const fullUrl = url.startsWith("http") ? url : `${config.baseUrl}${url}`;

    return flexFetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...normaliseHeaders(options?.headers),
      },
      retryAttempts: options?.retryAttempts ?? 3,
    });
  };
}
