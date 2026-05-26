import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
  beforeEach(() => {
    delete process.env.STAGE;
    delete process.env.USER;
  });

  afterEach(() => {
    delete process.env.STAGE;
    delete process.env.USER;
  });

  it("throws when neither STAGE nor USER is set", () => {
    expect(() => getEnvConfig()).toThrow("STAGE or USER env var not set");
  });

  it("returns persistent config for a known environment stage", () => {
    process.env.STAGE = "production";
    const config = getEnvConfig();
    expect(config).toEqual({
      env: Environment.production,
      stage: "production",
      persistent: true,
    });
  });

  it("returns development config for an ephemeral stage", () => {
    process.env.STAGE = "my-branch-123";
    const config = getEnvConfig();
    expect(config).toEqual({
      env: Environment.development,
      stage: "my-branch-12",
      persistent: false,
    });
  });

  it("falls back to USER when STAGE is not set", () => {
    process.env.USER = "staging";
    const config = getEnvConfig();
    expect(config.stage).toBe("staging");
    expect(config.persistent).toBe(true);
  });
});
