import { flexFetch, FlexFetchRequestInit } from "@flex/flex-fetch";
import { normaliseHeaders } from "@flex/utils";

export function createPublicFetch(config: { baseUrl: string }) {
  return (url: string, options: FlexFetchRequestInit = {}) => {
    const { headers, retryAttempts = 3 } = options;

    const fullUrl = url.startsWith("http") ? url : `${config.baseUrl}${url}`;

    return flexFetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...normaliseHeaders(headers),
      },
      retryAttempts,
    });
  };
}
