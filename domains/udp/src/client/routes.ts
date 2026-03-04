export const UDP_GATEWAY_BASE = "/gateways/udp/v1";

export const UDP_GATEWAY_ROUTES = {
  notifications: "/notifications",
  user: "/user",
} as const;

export const UDP_DOMAIN_BASE = "/domains/udp/v1";

export const UDP_DOMAIN_ROUTES = {
  createUser: "/user",
  patchUser: "/user",
} as const;
