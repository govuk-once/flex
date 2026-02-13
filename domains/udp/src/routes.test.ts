import { describe, expect, it } from "vitest";

import {
  buildPrivateGatewayUrl,
  UDP_DOMAIN_BASE,
  UDP_DOMAIN_ROUTES,
  UDP_GATEWAY_BASE,
  UDP_ROUTES,
} from "./routes";

describe("routes", () => {
  it.each([
    [
      UDP_GATEWAY_BASE,
      UDP_ROUTES.notifications,
      "/gateways/udp/v1/notifications",
    ],
    [UDP_GATEWAY_BASE, UDP_ROUTES.analytics, "/gateways/udp/v1/analytics"],
    [UDP_GATEWAY_BASE, UDP_ROUTES.preferences, "/gateways/udp/v1/preferences"],
    [UDP_DOMAIN_BASE, UDP_DOMAIN_ROUTES.user, "/domains/udp/v1/user"],
  ])(
    "should build the private gateway url for %s and %s",
    (base, route, expected) => {
      const result = buildPrivateGatewayUrl(base, route);
      expect(result).toEqual(expected);
    },
  );
});
