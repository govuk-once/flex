import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import type { IacDomainConfig } from "../types";
import { validateDomainIntegrations } from "./validate-integrations";

function makeConfig(
  name: string,
  routes: IacDomainConfig["routes"] = {},
  integrations?: IacDomainConfig["integrations"],
): IacDomainConfig {
  return { name, routes, integrations };
}

describe("validateDomainIntegrations", () => {
  it("passes when a domain integration resolves to a private route", () => {
    const consumer = makeConfig(
      "a",
      {},
      { getThing: { type: "domain", target: "b", route: "GET /v1/thing" } },
    );
    const producer = makeConfig("b", {
      v1: { "/thing": { GET: { private: { name: "get-thing" } } } },
    });

    expect(validateDomainIntegrations([consumer, producer])).toEqual([]);
  });

  it("matches a wildcard integration against a :param private route", () => {
    const consumer = makeConfig(
      "a",
      {},
      { getId: { type: "domain", target: "b", route: "GET /v1/identity/*" } },
    );
    const producer = makeConfig("b", {
      v1: {
        "/identity/:service": { GET: { private: { name: "get-identity" } } },
      },
    });

    expect(validateDomainIntegrations([consumer, producer])).toEqual([]);
  });

  it("matches a root-wildcard integration when the target has a private route at that version", () => {
    const consumer = makeConfig(
      "a",
      {},
      { getAny: { type: "domain", target: "b", route: "GET /v1/*" } },
    );
    const producer = makeConfig("b", {
      v1: {
        "/identity/:service": { GET: { private: { name: "get-identity" } } },
      },
    });

    expect(validateDomainIntegrations([consumer, producer])).toEqual([]);
  });

  it("flags a root-wildcard integration when the target has no matching private route", () => {
    const consumer = makeConfig(
      "a",
      {},
      { getAny: { type: "domain", target: "b", route: "GET /v2/*" } },
    );
    const producer = makeConfig("b", {
      v1: {
        "/identity/:service": { GET: { private: { name: "get-identity" } } },
      },
    });

    const violations = validateDomainIntegrations([consumer, producer]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("route-not-found");
  });

  it("supports self-targeting integrations", () => {
    const self = makeConfig(
      "a",
      { v0: { "/todos": { POST: { private: { name: "create-todo" } } } } },
      { createTodo: { type: "domain", route: "POST /v0/todos" } },
    );

    expect(validateDomainIntegrations([self])).toEqual([]);
  });

  it("flags a method mismatch", () => {
    const consumer = makeConfig(
      "a",
      {},
      { getN: { type: "domain", target: "b", route: "GET /v1/notifications" } },
    );
    const producer = makeConfig("b", {
      v1: { "/notifications": { POST: { private: { name: "create" } } } },
    });

    const violations = validateDomainIntegrations([consumer, producer]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("route-not-found");
  });

  it("flags a route exposed only as public", () => {
    const consumer = makeConfig(
      "a",
      {},
      { getN: { type: "domain", target: "b", route: "GET /v1/notifications" } },
    );
    const producer = makeConfig("b", {
      v1: { "/notifications": { GET: { public: { name: "get" } } } },
    });

    const violations = validateDomainIntegrations([consumer, producer]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("route-not-found");
  });

  it("flags an unknown target domain", () => {
    const consumer = makeConfig(
      "a",
      {},
      { ghost: { type: "domain", target: "missing", route: "GET /v1/x" } },
    );

    const violations = validateDomainIntegrations([consumer]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("target-not-found");
  });

  it("flags a consumed route the producer no longer exposes, naming each consumer", () => {
    const route = "GET /v1/users/push-id";
    const consumerOne = makeConfig(
      "a",
      {},
      { getPush: { type: "domain", target: "c", route } },
    );
    const consumerTwo = makeConfig(
      "b",
      {},
      { getPush: { type: "domain", target: "c", route } },
    );
    const producer = makeConfig("c", {
      v1: { "/users/me": { GET: { private: { name: "me" } } } },
    });

    const violations = validateDomainIntegrations([
      consumerOne,
      consumerTwo,
      producer,
    ]);
    expect(violations.map((v) => v.sourceDomain)).toEqual(["a", "b"]);
    expect(violations.every((v) => v.reason === "route-not-found")).toBe(true);
  });

  it("ignores gateway-type integrations", () => {
    const consumer = makeConfig(
      "a",
      {},
      { ext: { type: "gateway", target: "svc", route: "GET /v1/anything" } },
    );

    expect(validateDomainIntegrations([consumer])).toEqual([]);
  });

  it("reports the integration key, source domain, target and route", () => {
    const consumer = makeConfig(
      "a",
      {},
      { getN: { type: "domain", target: "b", route: "GET /v1/notifications" } },
    );
    const producer = makeConfig("b", {
      v1: { "/notifications": { POST: { private: { name: "create" } } } },
    });

    const [violation] = validateDomainIntegrations([consumer, producer]);
    expect(violation).toMatchObject({
      sourceDomain: "a",
      integrationKey: "getN",
      targetDomain: "b",
      route: "GET /v1/notifications",
    });
  });
});
