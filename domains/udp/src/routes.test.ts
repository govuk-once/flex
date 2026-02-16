import { describe, expect, it } from "vitest";

import {
  buildPrivateGatewayUrl,
  UDP_DOMAIN_BASE,
  UDP_DOMAIN_ROUTES,
  UDP_GATEWAY_BASE,
  UDP_GATEWAY_ROUTES,
} from "./routes";

describe("routes", () => {
  it.each([
    [
      UDP_GATEWAY_BASE,
      UDP_GATEWAY_ROUTES.notifications,
      "/gateways/udp/v1/notifications/",
    ],
    [UDP_GATEWAY_BASE, UDP_GATEWAY_ROUTES.user, "/gateways/udp/v1/user/"],
    [UDP_DOMAIN_BASE, UDP_DOMAIN_ROUTES.user, "/domains/udp/v1/user/"],
  ])(
    "should build the private gateway url for %s and %s",
    (base, route, expected) => {
      const result = buildPrivateGatewayUrl(base, route);
      expect(result).toEqual(expected);
    },
  );
});
