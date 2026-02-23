export const UDP_GATEWAY_BASE = "/gateways/udp/v1";

export const UDP_GATEWAY_ROUTES = {
  preferences: "/preferences",
  user: "/user",
} as const;

export const UDP_DOMAIN_BASE = "/domains/udp/v1";

export const UDP_DOMAIN_ROUTES = {
  createUser: "/user",
} as const;
