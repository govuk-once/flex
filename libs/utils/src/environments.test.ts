import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Environment,
  getEnvConfig,
  isPersistentEnvironment,
  isStageAllowed,
} from "./environments";

describe("isPersistentEnvironment", () => {
  it("returns true for known environment names", () => {
    expect(isPersistentEnvironment("development")).toBe(true);
    expect(isPersistentEnvironment("staging")).toBe(true);
    expect(isPersistentEnvironment("production")).toBe(true);
  });

  it("returns false for arbitrary stage names", () => {
    expect(isPersistentEnvironment("my-feature-branch")).toBe(false);
    expect(isPersistentEnvironment("pr-123")).toBe(false);
  });
});

describe("isStageAllowed", () => {
  it("returns true when environments list is undefined", () => {
    expect(isStageAllowed(undefined, "production")).toBe(true);
  });

  it("returns true when stage is not a persistent environment", () => {
    expect(isStageAllowed(["production"], "my-branch")).toBe(true);
  });

  it("returns true when stage is in the allowed list", () => {
    expect(isStageAllowed(["development", "production"], "production")).toBe(
      true,
    );
  });

  it("returns false when persistent stage is not in the allowed list", () => {
    expect(isStageAllowed(["production"], "staging")).toBe(false);
  });
});

describe("getEnvConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when neither STAGE nor USER is set", () => {
    vi.stubEnv("STAGE", "");
    vi.stubEnv("USER", "");
    expect(() => getEnvConfig()).toThrow("STAGE or USER env var not set");
  });

  it("returns persistent config for a known environment stage", () => {
    vi.stubEnv("STAGE", "production");
    const config = getEnvConfig();
    expect(config).toEqual({
      env: Environment.production,
      stage: "production",
      persistent: true,
    });
  });

  it("returns development config for an ephemeral stage", () => {
    vi.stubEnv("STAGE", "my-branch-123");
    const config = getEnvConfig();
    expect(config).toEqual({
      env: Environment.development,
      stage: "my-branch-12",
      persistent: false,
    });
  });
});
