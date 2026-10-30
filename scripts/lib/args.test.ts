import { describe, expect, it } from "vitest";

import { readFlag } from "./args";

describe("readFlag", () => {
  it("returns undefined when the flag is absent", () => {
    expect(readFlag(["collect", "--stage", "dev"], "--hours")).toBeUndefined();
  });

  it("returns the value after the flag", () => {
    expect(readFlag(["collect", "--stage", "dev"], "--stage")).toBe("dev");
  });

  it("returns the value of the first occurrence", () => {
    expect(readFlag(["--stage", "one", "--stage", "two"], "--stage")).toBe(
      "one",
    );
  });

  it("throws when the flag is the last argument", () => {
    expect(() => readFlag(["collect", "--stage"], "--stage")).toThrow(
      "--stage requires a value",
    );
  });

  it("throws when the next argument is another flag", () => {
    expect(() => readFlag(["--stage", "--apply"], "--stage")).toThrow(
      "--stage requires a value",
    );
  });

  it("throws when the value is an empty string", () => {
    expect(() => readFlag(["--stage", ""], "--stage")).toThrow(
      "--stage requires a value",
    );
  });
});
