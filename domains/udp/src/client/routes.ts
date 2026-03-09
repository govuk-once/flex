export const UDP_GATEWAY_BASE = "/gateways/udp/v1";

export const UDP_GATEWAY_ROUTES = {
  notifications: "/notifications",
  users: "/users",
  identity: "/identity",
} as const;

export const UDP_DOMAIN_BASE = "/domains/udp/v1";

export const UDP_DOMAIN_ROUTES = {
  createUser: "/users",
} as const;
