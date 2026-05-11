import type { IacDomainConfig } from "@flex/sdk";
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { isDomainDeployed, isRouteDeployed } from "./is-deployed";

const mockDomain = {
  name: "domain",
  environments: ["development", "staging"],
  routes: {
    v1: {
      "/none": { GET: { public: { name: "none", environments: [] } } },
      "/stage": {
        GET: { public: { name: "stage", environments: ["development"] } },
      },
      "/all": { GET: { public: { name: "all" } } },
    },
  },
} satisfies IacDomainConfig;

const ephemeralStages = ["username", "pr-123"];
const persistentStages = ["development", "staging", "production"];

describe("isDomainDeployed", () => {
  it.for(ephemeralStages)(
    'returns true for ephemeral stage "%s"',
    (stage, { env }) => {
      env.set({ STAGE: stage });
      expect(isDomainDeployed(mockDomain)).toBe(true);
    },
  );

  it.for([
    { stage: "development", state: "includes", expected: true },
    { stage: "staging", state: "includes", expected: true },
    { stage: "production", state: "excludes", expected: false },
  ])(
    'returns $expected when the domain "environments" field $state $stage',
    ({ stage, expected }, { env }) => {
      env.set({ STAGE: stage });
      expect(isDomainDeployed(mockDomain)).toBe(expected);
    },
  );

  it.for(persistentStages)(
    'returns true for "%s" when the domain "environments" field is not set',
    (stage, { env }) => {
      env.set({ STAGE: stage });
      expect(isDomainDeployed({ name: "domain", routes: {} })).toBe(true);
    },
  );

  it.for(persistentStages)(
    'returns false for "%s" when the domain "environments" field is empty',
    (stage, { env }) => {
      env.set({ STAGE: stage });
      expect(
        isDomainDeployed({ name: "domain", routes: {}, environments: [] }),
      ).toBe(false);
    },
  );
});

describe("isRouteDeployed", () => {
  it.for(ephemeralStages)(
    'returns true for ephemeral stage "%s"',
    (stage, { env }) => {
      env.set({ STAGE: stage });
      expect(isRouteDeployed(mockDomain, "GET /v1/none")).toBe(true);
      expect(isRouteDeployed(mockDomain, "GET /v1/stage")).toBe(true);
      expect(isRouteDeployed(mockDomain, "GET /v1/all")).toBe(true);
    },
  );

  it.for([
    { stage: "development", state: "includes", expected: true },
    { stage: "staging", state: "excludes", expected: false },
  ])(
    'returns $expected when the route "environments" field $state $stage',
    ({ stage, expected }, { env }) => {
      env.set({ STAGE: stage });
      expect(isRouteDeployed(mockDomain, "GET /v1/stage")).toBe(expected);
    },
  );

  it.for([
    { stage: "development", expected: true },
    { stage: "staging", expected: true },
    { stage: "production", expected: false },
  ])(
    'returns $expected for $stage when the route "environments" field is not set',
    ({ stage, expected }, { env }) => {
      env.set({ STAGE: stage });
      expect(isRouteDeployed(mockDomain, "GET /v1/all")).toBe(expected);
    },
  );

  it.for(["development", "staging"])(
    'returns false for "%s" when the route "environments" field is empty',
    (stage, { env }) => {
      env.set({ STAGE: stage });
      expect(isRouteDeployed(mockDomain, "GET /v1/none")).toBe(false);
    },
  );
});
