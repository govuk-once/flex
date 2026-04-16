import { flexFetch, FlexFetchRequestInit } from "@flex/flex-fetch";

export function createPublicFetch(config: { baseUrl: string }) {
  return (url: string, options?: FlexFetchRequestInit) => {
    const fullUrl = url.startsWith("http") ? url : `${config.baseUrl}${url}`;

    const headers =
      options?.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : Array.isArray(options?.headers)
          ? Object.fromEntries(options.headers)
          : (options?.headers ?? {});

    return flexFetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      retryAttempts: options?.retryAttempts ?? 3,
    });
  };
}
