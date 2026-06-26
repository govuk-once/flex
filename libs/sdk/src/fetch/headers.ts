import { logger } from "@flex/logging";

import { getRouteStore } from "../route";

export function buildHeaders(
  url: string | Request | URL,
  optionHeaders?: HeadersInit,
): Headers {
  // Seed from the Request's own headers, since passing a `headers` init to
  // fetch otherwise replaces them entirely.
  const headers = new Headers(url instanceof Request ? url.headers : undefined);

  new Headers(optionHeaders).forEach((value, key) => {
    headers.set(key, value);
  });

  try {
    const correlationId = getRouteStore().headers?.["x-correlation-id"];
    if (correlationId) {
      headers.set("x-correlation-id", correlationId);
    }
  } catch {
    logger.warn(
      "Fetch used outside of a route context. Skipping correlation id injection",
    );
  }

  return headers;
}
