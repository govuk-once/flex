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
 * {@link requestingUserHeaders} plus `requested-at`, which the upstream uses to order
 * write requests. `now` is injectable so callers can pin the timestamp.
 */
export function requestingUserWriteHeaders(
  apiKey: string,
  requestingServiceUserId: string,
  now: Date = new Date(),
) {
  return {
    ...requestingUserHeaders(apiKey, requestingServiceUserId),
    "requested-at": now.toISOString(),
  };
}
