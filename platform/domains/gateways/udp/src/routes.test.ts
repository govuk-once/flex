import { describe, expect, it } from "vitest";

import { matchRemoteRoute } from "./routes";

describe("matchRemoteRoute", () => {
  it.each([
    ["POST", "v1/notifications", "gateways/udp", { remotePath: "/gateways/udp/v1/notifications", method: "POST", requiresHeaders: true }],
    ["POST", "v1/analytics", "gateways/udp", { remotePath: "/gateways/udp/v1/analytics", method: "POST", requiresHeaders: true }],
    ["POST", "v1/preferences", "gateways/udp", { remotePath: "/gateways/udp/v1/preferences", method: "POST", requiresHeaders: true }],
  ])("should match the remote path and method for %s %s", (method, path, stageName, expected) => {
    const result = matchRemoteRoute(method, path, stageName);

    expect(result).toEqual(expected);
  });

  it("returns undefined when route is not registered", () => {
    const result = matchRemoteRoute("POST", "unknown/path", "gateways/udp");

    expect(result).toBeUndefined();
  });

  it("handles path with leading slash", () => {
    const result = matchRemoteRoute("POST", "/v1/user", "gateways/udp");

    expect(result).toEqual({ remotePath: "/gateways/udp/v1/user", method: "POST", requiresHeaders: false });
  });
});
