/**
 * Headers sent upstream for requests made on behalf of an app user.
 */
export function requestingUserHeaders(
  apiKey: string,
  requestingServiceUserId: string,
) {
  return {
    "x-api-key": apiKey,
    "requesting-service": "app",
    "requesting-service-user-id": requestingServiceUserId,
  };
}

/**
 * Adds `requested-at`, which the upstream uses to order write requests, to any
 * set of headers. `now` is injectable so callers can pin the timestamp.
 */
export function withRequestedAt<T extends Readonly<Record<string, string>>>(
  headers: T,
  now: Date = new Date(),
) {
  return { ...headers, "requested-at": now.toISOString() };
}
