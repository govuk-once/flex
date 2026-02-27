export const UDP_GATEWAY_BASE = "/gateways/udp/v1";

export const UDP_GATEWAY_ROUTES = {
  notifications: "/notifications",
  users: "/users",
} as const;

export const UDP_DOMAIN_BASE = "/domains/udp/v1";

export const UDP_DOMAIN_ROUTES = {
  createUser: "/users",
  createNotification: "/users/notifications",
  getNotification: "/users/notifications",
  patchNotification: "/users/notifications",
} as const;
