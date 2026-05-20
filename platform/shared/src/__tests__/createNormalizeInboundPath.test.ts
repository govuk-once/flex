import { describe, expect, it } from "vitest";

import { createNormalizeInboundPath } from "../createNormalizeInboundPath";

describe("createNormalizeInboundPath", () => {
  const normalize = createNormalizeInboundPath("/gateways/dvla");

  it("strips the prefix and returns the remainder", () => {
    expect(normalize("/gateways/dvla/v1/licence/abc")).toBe("/v1/licence/abc");
  });

  it("returns '/' when the path equals the prefix exactly", () => {
    expect(normalize("/gateways/dvla")).toBe("/");
  });

  it("returns the path unchanged when it does not start with the prefix", () => {
    expect(normalize("/v1/other")).toBe("/v1/other");
  });

  it("creates independent functions for different prefixes", () => {
    const normalizeUdp = createNormalizeInboundPath("/gateways/udp");
    expect(normalizeUdp("/gateways/udp/v1/user")).toBe("/v1/user");
    expect(normalize("/gateways/udp/v1/user")).toBe("/gateways/udp/v1/user");
  });
});
