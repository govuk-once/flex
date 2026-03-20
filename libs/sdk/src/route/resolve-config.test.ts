import { it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import type { DomainConfig, DomainResource, HttpMethod } from "../types";
import {
  getRouteAccess,
  getRouteConfig,
  getRouteFeatureFlags,
  getRouteIntegrations,
  getRouteLogLevel,
  getRouteResources,
} from "./resolve-config";

describe("getRouteAccess", () => {
  const common = "public";
  const route = "private";

  it("returns route-level access over common-level access", () => {
    expect(getRouteAccess(common, route)).toBe(route);
  });

  it("returns common-level access when route-level access is not defined", () => {
    expect(getRouteAccess(common)).toBe(common);
  });

  it('defaults to "isolated" access when common and route access are not defined', () => {
    expect(getRouteAccess()).toBe("isolated");
  });
});

describe("getRouteConfig", () => {
  const config: DomainConfig = {
    name: "test",
    routes: {
      v1: {
        "/endpoint": {
          GET: {
            public: { name: "public-route" },
            private: { name: "private-route" },
          },
        },
        "/user": {
          GET: { public: { name: "user-public-route" } },
        },
      },
    },
  };

  it.for<{ gateway: "public" | "private"; expected: Record<string, string> }>([
    { gateway: "public", expected: { name: "public-route" } },
    { gateway: "private", expected: { name: "private-route" } },
  ])("returns the $gateway gateway route config", ({ gateway, expected }) => {
    expect(
      getRouteConfig(config, {
        version: "v1",
        path: "/endpoint",
        method: "GET",
        gateway,
      }),
    ).toStrictEqual(expected);
  });

  it.for<{
    label: string;
    route: string;
    options: {
      version: string;
      path: string;
      method: HttpMethod;
      gateway: "public" | "private";
    };
  }>([
    {
      label: "the version is not defined in the domain config",
      route: "GET /v2/endpoint",
      options: {
        version: "v2",
        path: "/endpoint",
        method: "GET",
        gateway: "public",
      },
    },
    {
      label: "the path does not exist in the route version",
      route: "GET /v1/unknown",
      options: {
        version: "v1",
        path: "/unknown",
        method: "GET",
        gateway: "public",
      },
    },
    {
      label: "the HTTP method does not exist in the route path",
      route: "DELETE /v1/endpoint",
      options: {
        version: "v1",
        path: "/endpoint",
        method: "DELETE",
        gateway: "public",
      },
    },
    {
      label: "the gateway is not defined for the route",
      route: "GET /v1/user [private]",
      options: {
        version: "v1",
        path: "/user",
        method: "GET",
        gateway: "private",
      },
    },
  ])("throws when $label", ({ options, route }) => {
    expect(() => getRouteConfig(config, options)).toThrow(
      `Route config for "${route}" does not exist`,
    );
  });
});

describe("getRouteIntegrations", () => {
  const integrations = { one: vi.fn(), two: vi.fn() };

  it("returns undefined when there are no domain integrations", () => {
    expect(getRouteIntegrations()).toBeUndefined();
    expect(getRouteIntegrations(undefined, ["one", "two"])).toBeUndefined();
  });

  it("returns undefined when domain integrations exist but the route has not referenced any integrations", () => {
    expect(getRouteIntegrations(integrations)).toBeUndefined();
    expect(getRouteIntegrations(integrations, [])).toBeUndefined();
  });

  it("returns all domain integrations referenced by the route", () => {
    expect(getRouteIntegrations(integrations, ["one", "two"])).toStrictEqual(
      integrations,
    );
  });

  it("throws when a route references an integration that has not been defined in the domain", () => {
    expect(() => getRouteIntegrations(integrations, ["missing"])).toThrow(
      '"missing" referenced in "integrations" but the domain integration has not been defined',
    );
  });
});

describe("getRouteLogLevel", () => {
  const common = "DEBUG";
  const route = "TRACE";

  it("returns route log level over common log level", () => {
    expect(getRouteLogLevel(common, route)).toBe(route);
  });

  it("returns common log level when route log level is not defined", () => {
    expect(getRouteLogLevel(common)).toBe(common);
  });

  it('defaults to "INFO" log level when common and route log levels are not defined', () => {
    expect(getRouteLogLevel()).toBe("INFO");
  });
});

describe("getRouteResources", () => {
  const resources: {
    [key: string]:
      | DomainResource<"kms">
      | DomainResource<"ssm">
      | DomainResource<"secret">;
  } = {
    testKey: { type: "kms", path: "/path/to/key" },
    testParam: { type: "ssm", path: "/path/to/param" },
    testSecret: { type: "secret", path: "/path/to/secret" },
  };

  it("returns undefined when there are no domain resources", () => {
    expect(getRouteResources(undefined)).toBeUndefined();
    expect(getRouteResources(undefined, ["testKey"])).toBeUndefined();
  });

  it("returns undefined when domain resources exist but the route has not referenced any resources", () => {
    expect(getRouteResources(resources)).toBeUndefined();
    expect(getRouteResources(resources, [])).toBeUndefined();
  });

  it("returns all domain resources referenced by the route", ({ env }) => {
    env.set({
      testKey: "test-key",
      testParam: "test-param",
      testSecret: "test-secret", // pragma: allowlist secret
    });

    expect(
      getRouteResources(resources, ["testKey", "testParam", "testSecret"]),
    ).toStrictEqual(
      new Map([
        ["testKey", { type: "kms", value: "test-key" }],
        ["testParam", { type: "ssm", value: "test-param" }],
        ["testSecret", { type: "secret", value: "test-secret" }],
      ]),
    );
  });

  it("throws when a route references a resource that has not been defined in the domain", () => {
    const key = "unknown";

    expect(() => getRouteResources(resources, [key])).toThrow(
      `"${key}" referenced in "resources" but was not defined in domain resources`,
    );
  });

  it("throws when the environment variable for a referenced resource has not been set", () => {
    const key = "testKey";

    expect(() => getRouteResources(resources, [key])).toThrow(
      `Environment variable "${key}" not set. Has this resource been provisioned?`,
    );
  });
});

describe("getRouteFeatureFlags", () => {
  const flags = {
    myFlag: { default: false },
    envAwareFlag: {
      default: false,
      environments: { development: true, staging: true, production: false },
    },
  };

  it("returns undefined when there are no domain feature flags", () => {
    expect(getRouteFeatureFlags(undefined)).toBeUndefined();
    expect(getRouteFeatureFlags(undefined, ["myFlag"])).toBeUndefined();
  });

  it("returns undefined when domain feature flags exist but the route has not referenced any", () => {
    expect(getRouteFeatureFlags(flags)).toBeUndefined();
    expect(getRouteFeatureFlags(flags, [])).toBeUndefined();
  });

  it("throws when a route references a flag that has not been defined in the domain", () => {
    expect(() => getRouteFeatureFlags(flags, ["unknown"])).toThrow(
      '"unknown" referenced in "featureFlags" but was not defined in domain featureFlags',
    );
  });

  describe("resolution order", () => {
    it("uses the process.env override when set to 'true'", ({ env }) => {
      env.set({ myFlag: "true" });

      expect(getRouteFeatureFlags(flags, ["myFlag"])).toStrictEqual(
        new Map([["myFlag", { value: true }]]),
      );
    });

    it("uses the process.env override when set to 'false', even when default is true", ({
      env,
    }) => {
      const flagWithTrueDefault = { myFlag: { default: true } };
      env.set({ myFlag: "false" });

      expect(
        getRouteFeatureFlags(flagWithTrueDefault, ["myFlag"]),
      ).toStrictEqual(new Map([["myFlag", { value: false }]]));
    });

    it("uses the environment-specific value when no process.env override is set", ({
      env,
    }) => {
      env.set({ STAGE: "staging" });

      expect(getRouteFeatureFlags(flags, ["envAwareFlag"])).toStrictEqual(
        new Map([["envAwareFlag", { value: true }]]),
      );
    });

    it("falls back to the global default when no env override or environment-specific value matches", ({
      env,
    }) => {
      env.set({ STAGE: "staging" });

      expect(getRouteFeatureFlags(flags, ["myFlag"])).toStrictEqual(
        new Map([["myFlag", { value: false }]]),
      );
    });

    it("falls back to false when no env override, environment value, or default is set", ({
      env,
    }) => {
      const flagWithNoDefault = { myFlag: {} };
      env.delete("STAGE");

      expect(getRouteFeatureFlags(flagWithNoDefault, ["myFlag"])).toStrictEqual(
        new Map([["myFlag", { value: false }]]),
      );
    });
  });

  describe("environment resolution", () => {
    it.for([
      { stage: "development", expected: true },
      { stage: "staging", expected: true },
      { stage: "production", expected: false },
    ])(
      "resolves the $stage environment-specific value when STAGE=$stage",
      ({ stage, expected }, { env }) => {
        env.set({ STAGE: stage });

        expect(getRouteFeatureFlags(flags, ["envAwareFlag"])).toStrictEqual(
          new Map([["envAwareFlag", { value: expected }]]),
        );
      },
    );

    it("treats a personal stage as 'development'", ({ env }) => {
      env.set({ STAGE: "ljones" });

      expect(getRouteFeatureFlags(flags, ["envAwareFlag"])).toStrictEqual(
        new Map([["envAwareFlag", { value: true }]]),
      );
    });

    it("treats an unset STAGE as 'development'", ({ env }) => {
      env.delete("STAGE");

      expect(getRouteFeatureFlags(flags, ["envAwareFlag"])).toStrictEqual(
        new Map([["envAwareFlag", { value: true }]]),
      );
    });

    it("process.env override takes precedence over the environment-specific value", ({
      env,
    }) => {
      env.set({ STAGE: "staging", envAwareFlag: "false" });

      expect(getRouteFeatureFlags(flags, ["envAwareFlag"])).toStrictEqual(
        new Map([["envAwareFlag", { value: false }]]),
      );
    });
  });
});
