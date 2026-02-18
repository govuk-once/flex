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
      {
        base: UDP_GATEWAY_BASE,
        route: UDP_GATEWAY_ROUTES.notifications,
        expected: "/gateways/udp/v1/notifications/",
      },
    ],
    [
      {
        base: UDP_GATEWAY_BASE,
        route: UDP_GATEWAY_ROUTES.user,
        expected: "/gateways/udp/v1/user/",
      },
    ],
    [
      {
        base: UDP_DOMAIN_BASE,
        route: UDP_DOMAIN_ROUTES.user,
        expected: "/domains/udp/v1/user/",
      },
    ],
  ])(
    "should build the private gateway url for %s and %s",
    ({ base, route, expected }) => {
      const result = buildPrivateGatewayUrl(base, route);
      expect(result).toEqual(expected);
    },
  );
});
