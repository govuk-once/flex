import { flexFetch, FlexFetchRequestInit } from "@flex/flex-fetch";

// NOSONAR Moved to service gateway lib, original implementation to be removed
function normaliseHeaders(
  headers: Headers | Record<string, string> | [string, string][] | undefined,
) {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers ?? {};
}

// NOSONAR Moved to service gateway lib, original implementation to be removed
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
