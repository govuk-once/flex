import { describe, expect, it } from "vitest";

import { splitRouteKey, splitVersionedPath, stripPathPrefix } from "./route";

describe("splitRouteKey", () => {
  it.for([
    { input: "GET /v1/example", expected: ["GET", "/v1/example"] },
    { input: "GET /v1/example/:id", expected: ["GET", "/v1/example/:id"] },
  ])("returns $expected for $input", ({ input, expected }) => {
    expect(splitRouteKey(input)).toStrictEqual(expected);
  });

  it.for([
    { input: undefined as never, reason: "missing" },
    { input: "", reason: "an empty string" },
    { input: "GET", reason: "missing a path" },
    { input: "/v1/example", reason: "missing a method" },
  ])("returns null when the value is $reason", ({ input }) => {
    expect(splitRouteKey(input)).toBeNull();
  });
});

describe("stripPathPrefix", () => {
  it("strips the path when the prefix matches the first path segment", () => {
    expect(stripPathPrefix("/a/b/c", "/a")).toBe("/b/c");
  });

  it("returns the fallback path when the path and prefix are identical", () => {
    expect(stripPathPrefix("/a", "/a")).toBe("/");
  });

  it("returns the path unchanged when the prefix does not match the first path segment", () => {
    expect(stripPathPrefix("/x/y/z", "/a")).toBe("/x/y/z");
  });

  it("returns the path unchanged when the prefix partially matches the first path segment", () => {
    expect(stripPathPrefix("/abc", "/a")).toBe("/abc");
  });

  it("returns the stripped path with duplicate path segments unchanged", () => {
    expect(stripPathPrefix("/a/b/a", "/a")).toBe("/b/a");
  });
});

describe("splitVersionedPath", () => {
  it.for([
    { input: "/v1/example", expected: ["v1", "/example"] },
    { input: "/v1/example/path", expected: ["v1", "/example/path"] },
  ])("returns $expected for $input", ({ input, expected }) => {
    expect(splitVersionedPath(input)).toStrictEqual(expected);
  });

  it.for([
    { input: undefined as never, reason: "missing" },
    { input: "", reason: "an empty string" },
    { input: "/v1", reason: "missing a path" },
  ])("returns null when the value is $reason", ({ input }) => {
    expect(splitVersionedPath(input)).toBeNull();
  });
});
