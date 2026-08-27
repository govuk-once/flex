import { describe, expect, it } from "vitest";

import {
  createFixtureBuilder,
  createFixtureVariants,
  mergeFixture,
} from "./fixtures";

describe("mergeFixture", () => {
  const obj = { a: "a", b: "b", c: { d: "d" } };

  it("returns the base when called with no overrides", () => {
    expect(mergeFixture(obj)).toStrictEqual(obj);
  });

  it("deeply merges overrides and preserves original fields", () => {
    expect(mergeFixture(obj, { a: "value", c: { d: "value" } })).toStrictEqual({
      ...obj,
      a: "value",
      c: { d: "value" },
    });
  });

  it("returns a new object and does not mutate the original", () => {
    const clone = structuredClone(obj);
    const result = mergeFixture(obj, { a: "value", c: { d: "value" } });

    expect(obj).toStrictEqual(clone);
    expect(result).not.toStrictEqual(obj);
    expect(result.c).not.toBe(obj.c);
  });
});

describe("createFixtureBuilder", () => {
  const obj = { a: "a", b: "b", c: "c" };

  it("returns base value unchanged when called with no arguments", () => {
    expect(createFixtureBuilder(obj)()).toStrictEqual(obj);
  });

  it("returns base value unchanged when called with an empty object", () => {
    expect(createFixtureBuilder(obj)({})).toStrictEqual(obj);
  });

  it("preserves base fields and overwrites all conflicting fields", () => {
    expect(createFixtureBuilder(obj)({ b: "new" })).toStrictEqual({
      a: "a",
      b: "new",
      c: "c",
    });
  });

  it("does not mutate the base input", () => {
    const existing = { ...obj };

    createFixtureBuilder(obj)({ b: "new" });

    expect(obj).toStrictEqual(existing);
  });
});

describe("createFixtureVariants", () => {
  const obj = { a: "a", b: "b" };
  const variants = () => ({});

  it("returns a callable function", () => {
    const fn = createFixtureVariants(obj, variants);

    expect(fn({ a: "new" })).toStrictEqual({
      a: "new",
      b: "b",
    });
  });

  it("assigns a custom method alongside the base function", () => {
    const fn = createFixtureVariants(obj, (build) => ({
      updateA: (value: string) => build({ a: value }),
    }));

    expect(fn.updateA("new")).toStrictEqual({
      a: "new",
      b: "b",
    });
  });
});
