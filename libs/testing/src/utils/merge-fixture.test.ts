import { describe, expect, it } from "vitest";

import { mergeFixture } from "./merge-fixture";

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
