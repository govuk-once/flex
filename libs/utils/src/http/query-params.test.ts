import { describe, expect, it } from "vitest";

import { extractQueryParams } from "./query-params";

describe("extractQueryParams", () => {
  it("returns empty string and empty object for no params", () => {
    const [str, obj] = extractQueryParams();
    expect(str).toBe("");
    expect(obj).toEqual({});
  });

  it("handles a string value", () => {
    const [str, obj] = extractQueryParams({ foo: "bar" });
    expect(str).toBe("foo=bar");
    expect(obj).toEqual({ foo: "bar" });
  });

  it("handles a number value", () => {
    const [str, obj] = extractQueryParams({ page: 2 });
    expect(str).toBe("page=2");
    expect(obj).toEqual({ page: "2" });
  });

  it("handles a boolean value", () => {
    const [str, obj] = extractQueryParams({ active: true });
    expect(str).toBe("active=true");
    expect(obj).toEqual({ active: "true" });
  });

  it("appends multiple entries for an array value", () => {
    const [str] = extractQueryParams({ ids: ["a", "b", "c"] });
    expect(str).toBe("ids=a&ids=b&ids=c");
  });

  it("handles mixed scalar and array params", () => {
    const [str] = extractQueryParams({ q: "hello", tags: ["x", "y"] });
    expect(str).toContain("q=hello");
    expect(str).toContain("tags=x");
    expect(str).toContain("tags=y");
  });

  it("handles an empty params object", () => {
    const [str, obj] = extractQueryParams({});
    expect(str).toBe("");
    expect(obj).toEqual({});
  });
});
