import { CORRELATION_ID_HEADER, getCorrelationId } from "../correlation";

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

  const correlationId = getCorrelationId();
  if (correlationId) {
    headers.set(CORRELATION_ID_HEADER, correlationId);
  }

  return headers;
}
