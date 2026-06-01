import { describe, expect, it } from "vitest";

import { createFixtureBuilder, createFixtureFactory } from "./factory";

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

describe("createFixtureFactory", () => {
  const obj = { a: "a", b: "b" };
  const variants = () => ({});

  it("returns a callable function", () => {
    const fn = createFixtureFactory(obj, variants);

    expect(fn({ a: "new" })).toStrictEqual({
      a: "new",
      b: "b",
    });
  });

  it("assigns a custom method alongside the base function", () => {
    const fn = createFixtureFactory(obj, (build) => ({
      updateA: (value: string) => build({ a: value }),
    }));

    expect(fn.updateA("new")).toStrictEqual({
      a: "new",
      b: "b",
    });
  });
});
