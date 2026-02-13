export const UDP_GATEWAY_BASE = "/gateways/udp/v1";

export const UDP_ROUTES = {
  notifications: "notifications",
  analytics: "analytics",
  preferences: "preferences",
} as const;

export const UDP_DOMAIN_BASE = "/domains/udp/v1";

export const UDP_DOMAIN_ROUTES = {
  user: "user",
} as const;

/**
 * Builds a base URL with a trailing slash so relative paths append correctly.
 * Without this, new URL("path", base) replaces the last segment instead of appending.
 */
export function buildPrivateGatewayUrl(
  baseUrl: URL | string,
  pathPrefix: string,
): string {
  const base = typeof baseUrl === "string" ? baseUrl : baseUrl.toString();
  const normalized = base.replace(/\/$/, "");
  const prefix = pathPrefix.replace(/^\//, "");
  return `${normalized}/${prefix}`;
}
