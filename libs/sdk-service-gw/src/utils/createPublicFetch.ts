import { flexFetch, FlexFetchRequestInit } from "@flex/flex-fetch";

/**
 * Configuration for the public fetch client.
 */
interface PublicFetchConfig {
  baseUrl: string;
}

/**
 * Creates a specialized fetch client that automatically prepends a base URL,
 * normalizes headers, and sets platform-standard defaults like retries.
 * * @param config - The configuration object containing the service's base URL.
 * @returns An async fetch function compatible with `FlexFetchRequestInit`.
 * * @example
 * const dvlaFetch = createPublicFetch({ baseUrl: 'https://api.dvla.gov.uk' });
 * const response = await dvlaFetch('/vehicles/123', { method: 'GET' });
 */
export function createPublicFetch(config: PublicFetchConfig) {
  return (url: string, options?: FlexFetchRequestInit) => {
    // URL Construction: Only prepend baseUrl if url is a relative path
    const fullUrl = url.startsWith("http") ? url : `${config.baseUrl}${url}`;

    // Header Normalization: Convert Headers object, Array, or Record into a plain object
    const headers =
      options?.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : Array.isArray(options?.headers)
          ? Object.fromEntries(options.headers)
          : (options?.headers ?? {});

    // Execution: Merge standard headers and apply default retry logic
    return flexFetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      // Default to 3 retries if not explicitly provided in options
      retryAttempts: options?.retryAttempts ?? 3,
    });
  };
}
