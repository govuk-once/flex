export function normaliseHeaders(
  headers: Headers | Record<string, string> | [string, string][] | undefined,
) {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers ?? {};
}
